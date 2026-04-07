/**
 * LSP Client - Connects to language servers via stdio
 *
 * Implements the Language Server Protocol for communicating with
 * language servers like typescript-language-server, pylsp, etc.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { LspServerConfig } from './servers.js';

export const DEFAULT_LSP_REQUEST_TIMEOUT_MS = 10_000;

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface Hover {
  contents: { value: string } | { value: string; kind: string } | string;
  range?: Range;
}

export interface Diagnostic {
  range: Range;
  severity: number;
  code?: string | number;
  source?: string;
  message: string;
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export interface WorkspaceEdit {
  changes?: Record<string, Array<{ range: Range; newText: string }>>;
  documentChanges?: Array<{
    textDocument: { uri: string; version: number | null };
    edits: Array<{ range: Range; newText: string }>;
  }>;
}

export interface CodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
  command?: { title: string; command: string; arguments?: unknown[] };
}

let _requestId = 0;

function nextRequestId(): number {
  return ++_requestId;
}

export function uriToPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice(7));
  }
  return uri;
}

export function pathToUri(path: string): string {
  return `file://${path}`;
}

export class LspClient {
  private process: ChildProcess | null = null;
  private buffer = '';
  private contentLength = -1;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private initialized = false;
  private rootUri: string;
  private diagnosticsCache = new Map<string, Diagnostic[]>();

  constructor(
    private config: LspServerConfig,
    private workspaceRoot: string,
  ) {
    this.rootUri = pathToUri(workspaceRoot);
  }

  get supportsPullDiagnostics(): boolean {
    return false;
  }

  async start(): Promise<void> {
    if (this.process) return;

    const { command, args } = this.config;
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workspaceRoot,
    });

    this.process.stdout?.on('data', (chunk: Buffer) => this.handleData(chunk.toString()));
    this.process.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[LSP ${this.config.name}] stderr: ${chunk.toString()}`);
    });

    this.process.on('exit', (code) => {
      this.process = null;
      this.initialized = false;
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`LSP server exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const result = await this.request('initialize', {
      processId: process.pid,
      clientInfo: { name: 'oh-my-qwen', version: '0.1.0' },
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['plaintext', 'markdown'] },
          declaration: { linkSupport: true },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          workspaceSymbol: {},
          publishDiagnostics: { relatedInformation: true },
          rename: { prepareSupport: true },
          codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: [''] } } },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
      workspaceFolders: [{ uri: this.rootUri, name: this.workspaceRoot }],
      initializationOptions: this.config.initializationOptions,
    });

    this.initialized = true;
    await this.notify('initialized', {});
  }

  async stop(): Promise<void> {
    if (this.process) {
      await this.notify('shutdown', {});
      await this.notify('exit', {});
      this.process.stdin?.end();
      this.process = null;
      this.initialized = false;
    }
  }

  async openDocument(filePath: string): Promise<void> {
    if (!existsSync(filePath)) return;
    const { readFileSync } = await import('fs');
    const text = readFileSync(filePath, 'utf-8');

    await this.notify('textDocument/didOpen', {
      textDocument: {
        uri: pathToUri(filePath),
        languageId: this.getLanguageId(filePath),
        version: 1,
        text,
      },
    });
  }

  async hover(file: string, line: number, character: number): Promise<Hover | null> {
    return this.request('textDocument/hover', {
      textDocument: { uri: pathToUri(file) },
      position: { line, character },
    }) as Promise<Hover | null>;
  }

  async definition(file: string, line: number, character: number): Promise<Location[] | null> {
    return this.request('textDocument/definition', {
      textDocument: { uri: pathToUri(file) },
      position: { line, character },
    }) as Promise<Location[] | null>;
  }

  async references(file: string, line: number, character: number, includeDeclaration = true): Promise<Location[] | null> {
    return this.request('textDocument/references', {
      textDocument: { uri: pathToUri(file) },
      position: { line, character },
      context: { includeDeclaration },
    }) as Promise<Location[] | null>;
  }

  async documentSymbols(file: string): Promise<DocumentSymbol[] | null> {
    return this.request('textDocument/documentSymbol', {
      textDocument: { uri: pathToUri(file) },
    }) as Promise<DocumentSymbol[] | null>;
  }

  async workspaceSymbols(query: string): Promise<WorkspaceSymbol[] | null> {
    return this.request('workspace/symbol', { query }) as Promise<WorkspaceSymbol[] | null>;
  }

  async pullDiagnostics(file: string): Promise<Diagnostic[]> {
    const result = await this.request('textDocument/diagnostic', {
      textDocument: { uri: pathToUri(file) },
    }) as { kind: string; items: Diagnostic[] } | null;
    return result?.items || this.diagnosticsCache.get(file) || [];
  }

  async waitForDiagnostics(file: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.diagnosticsCache.has(file)) return;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  getDiagnostics(file: string): Diagnostic[] {
    return this.diagnosticsCache.get(file) || [];
  }

  async prepareRename(file: string, line: number, character: number): Promise<Range | null> {
    return this.request('textDocument/prepareRename', {
      textDocument: { uri: pathToUri(file) },
      position: { line, character },
    }) as Promise<Range | null>;
  }

  async rename(file: string, line: number, character: number, newName: string): Promise<WorkspaceEdit | null> {
    return this.request('textDocument/rename', {
      textDocument: { uri: pathToUri(file) },
      position: { line, character },
      newName,
    }) as Promise<WorkspaceEdit | null>;
  }

  async codeActions(file: string, range: Range): Promise<CodeAction[] | null> {
    return this.request('textDocument/codeAction', {
      textDocument: { uri: pathToUri(file) },
      range,
      context: { diagnostics: this.diagnosticsCache.get(file) || [] },
    }) as Promise<CodeAction[] | null>;
  }

  private getLanguageId(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
      kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp', cs: 'csharp',
      html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml',
    };
    return langMap[ext || ''] || 'plaintext';
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = nextRequestId();
      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      const header = `Content-Length: ${Buffer.byteLength(message, 'utf-8')}\r\n\r\n`;
      this.process?.stdin?.write(header + message, 'utf-8');

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out after ${DEFAULT_LSP_REQUEST_TIMEOUT_MS}ms`));
        }
      }, DEFAULT_LSP_REQUEST_TIMEOUT_MS);
    });
  }

  private notify(method: string, params: unknown): Promise<void> {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });
    const header = `Content-Length: ${Buffer.byteLength(message, 'utf-8')}\r\n\r\n`;
    this.process?.stdin?.write(header + message, 'utf-8');
    return Promise.resolve();
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.contentLength === -1) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1], 10);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) return;

      const content = this.buffer.slice(0, this.contentLength);
      this.buffer = this.buffer.slice(this.contentLength);
      this.contentLength = -1;

      try {
        this.handleMessage(JSON.parse(content));
      } catch (e) {
        console.error('[LSP] Failed to parse message:', e);
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    if (msg.id !== undefined && typeof msg.id === 'number') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if ('error' in msg) {
          pending.reject(new Error(String((msg.error as Record<string, unknown>)?.message ?? msg.error)));
        } else {
          pending.resolve(msg.result);
        }
      }
    } else if (msg.method === 'textDocument/publishDiagnostics') {
      const params = msg.params as { uri: string; diagnostics: Diagnostic[] };
      this.diagnosticsCache.set(uriToPath(params.uri), params.diagnostics);
    }
  }
}

export interface WorkspaceSymbol {
  name: string;
  kind: number;
  location: Location;
  containerName?: string;
}

/**
 * LSP Client Manager - caches and reuses clients
 */
class LspClientManager {
  private clients = new Map<string, LspClient>();

  async getClientForFile(filePath: string, config: LspServerConfig, workspaceRoot: string): Promise<LspClient> {
    const key = `${workspaceRoot}:${config.command}`;
    let client = this.clients.get(key);

    if (!client) {
      client = new LspClient(config, workspaceRoot);
      await client.start();
      this.clients.set(key, client);
    }

    return client;
  }

  async runWithClientLease<T>(
    filePath: string,
    config: LspServerConfig,
    workspaceRoot: string,
    fn: (client: LspClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClientForFile(filePath, config, workspaceRoot);
    return fn(client);
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(c => c.stop());
    this.clients.clear();
    await Promise.all(promises);
  }
}

export const lspClientManager = new LspClientManager();

// Formatting utilities
export function formatHover(hover: Hover | null): string {
  if (!hover) return 'No hover information available';
  const content = hover.contents;
  if (typeof content === 'string') return content;
  return content.value;
}

export function formatLocations(locations: Location[] | null): string {
  if (!locations || locations.length === 0) return 'No locations found';
  return locations.map((loc, i) => {
    const path = uriToPath(loc.uri);
    const line = loc.range.start.line + 1;
    const col = loc.range.start.character + 1;
    return `${i + 1}. ${path}:${line}:${col}`;
  }).join('\n');
}

export function formatDocumentSymbols(symbols: DocumentSymbol[] | null): string {
  if (!symbols || symbols.length === 0) return 'No symbols found';
  const kindNames: Record<number, string> = {
    1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class',
    6: 'Method', 7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum',
    11: 'Interface', 12: 'Function', 13: 'Variable', 14: 'Constant',
    15: 'String', 16: 'Number', 17: 'Boolean', 18: 'Array', 19: 'Object',
    20: 'Key', 21: 'Null', 22: 'EnumMember', 23: 'Struct', 24: 'Event',
    25: 'Operator', 26: 'TypeParameter',
  };

  function renderSymbols(syms: DocumentSymbol[], indent = ''): string {
    return syms.map(s => {
      const kind = kindNames[s.kind] || 'Unknown';
      const line = s.selectionRange.start.line + 1;
      const detail = s.detail ? ` (${s.detail})` : '';
      const children = s.children?.length ? '\n' + renderSymbols(s.children, indent + '  ') : '';
      return `${indent}${s.name} — ${kind}${detail} (line ${line})${children}`;
    }).join('\n');
  }

  return renderSymbols(symbols);
}

export function formatWorkspaceSymbols(symbols: WorkspaceSymbol[] | null): string {
  if (!symbols || symbols.length === 0) return 'No workspace symbols found';
  return symbols.map(s => {
    const path = uriToPath(s.location.uri);
    const line = s.location.range.start.line + 1;
    const container = s.containerName ? ` [${s.containerName}]` : '';
    return `${s.name} — ${path}:${line}${container}`;
  }).join('\n');
}

export function formatDiagnostics(diagnostics: Diagnostic[], file: string): string {
  if (diagnostics.length === 0) return 'No diagnostics';
  const severityNames: Record<number, string> = { 1: 'Error', 2: 'Warning', 3: 'Info', 4: 'Hint' };
  return diagnostics.map(d => {
    const line = d.range.start.line + 1;
    const col = d.range.start.character + 1;
    const severity = severityNames[d.severity] || 'Unknown';
    const source = d.source ? ` (${d.source})` : '';
    const code = d.code ? ` [${d.code}]` : '';
    return `${severity}${source}${code} ${line}:${col}\n  ${d.message}`;
  }).join('\n\n');
}

export function formatCodeActions(actions: CodeAction[] | null): string {
  if (!actions || actions.length === 0) return 'No code actions available';
  return actions.map((a, i) => {
    const kind = a.kind ? ` [${a.kind}]` : '';
    const preferred = a.isPreferred ? ' (Preferred)' : '';
    return `${i + 1}. ${a.title}${kind}${preferred}`;
  }).join('\n');
}

export function formatWorkspaceEdit(edit: WorkspaceEdit): string {
  const changes = edit.changes || {};
  const fileEntries = Object.entries(changes);
  if (fileEntries.length === 0) return 'No edits returned';

  return fileEntries.map(([uri, edits]) => {
    const path = uriToPath(uri);
    const editList = edits.map((e, i) => {
      const line = e.range.start.line + 1;
      const col = e.range.start.character + 1;
      const preview = e.newText.length > 60 ? e.newText.slice(0, 60) + '...' : e.newText;
      return `  ${i + 1}. ${line}:${col} → "${preview.replace(/\n/g, '\\n')}"`;
    }).join('\n');
    return `${path} (${edits.length} edit(s)):\n${editList}`;
  }).join('\n\n');
}

export function countEdits(edit: WorkspaceEdit): { files: number; edits: number } {
  const changes = edit.changes || {};
  const files = Object.keys(changes).length;
  const edits = Object.values(changes).reduce((sum, e) => sum + e.length, 0);
  return { files, edits };
}
