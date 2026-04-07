/**
 * LSP Tools for OMQ MCP Server
 *
 * Re-exports LSP tool definitions that can be registered with the MCP server.
 * Provides IDE-like capabilities via real LSP server integration.
 */

import { z } from 'zod';
import { lspClientManager, getServerForFile, getAllServers, formatHover, formatLocations, formatDocumentSymbols, formatWorkspaceSymbols, formatDiagnostics, formatCodeActions, formatWorkspaceEdit, countEdits } from './lsp/index.js';
import { getServerForLanguage } from './lsp/servers.js';

async function withLspClient<T>(
  filePath: string,
  operation: string,
  fn: (client: any) => Promise<T>,
): Promise<{ isError?: boolean; content: Array<{ type: 'text'; text: string }> }> {
  try {
    const serverConfig = getServerForFile(filePath);
    if (!serverConfig) {
      return {
        isError: true,
        content: [{ type: 'text', text: `No language server available for: ${filePath}\n\nAvailable servers: ${Object.keys(getAllServers()).join(', ')}` }],
      };
    }
    if (!serverConfig.installed) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Language server not installed: ${serverConfig.name}\n\nInstall: ${serverConfig.installHint}` }],
      };
    }

    const result = await lspClientManager.runWithClientLease(filePath, serverConfig, process.cwd(), fn);
    return { content: [{ type: 'text', text: String(result) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error in ${operation}: ${message}` }],
    };
  }
}

// ============================================================
// Tool: lsp_hover
// ============================================================
export const lspHoverTool = {
  name: 'lsp_hover',
  description: 'Get type information and documentation at a specific position. Useful for understanding what a symbol represents.',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    line: z.number().int().min(1).describe('Line number (1-indexed)'),
    character: z.number().int().min(0).describe('Character position (0-indexed)'),
  }),
  handler: async ({ file, line, character }: { file: string; line: number; character: number }) =>
    withLspClient(file, 'hover', async (client) => {
      const hover = await client.hover(file, line - 1, character);
      return formatHover(hover);
    }),
};

// ============================================================
// Tool: lsp_goto_definition
// ============================================================
export const lspGotoDefinitionTool = {
  name: 'lsp_goto_definition',
  description: 'Find the definition location of a symbol (function, variable, class, etc.).',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    line: z.number().int().min(1).describe('Line number (1-indexed)'),
    character: z.number().int().min(0).describe('Character position (0-indexed)'),
  }),
  handler: async ({ file, line, character }: { file: string; line: number; character: number }) =>
    withLspClient(file, 'goto definition', async (client) => {
      const locations = await client.definition(file, line - 1, character);
      return formatLocations(locations);
    }),
};

// ============================================================
// Tool: lsp_find_references
// ============================================================
export const lspFindReferencesTool = {
  name: 'lsp_find_references',
  description: 'Find all references to a symbol across the codebase.',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    line: z.number().int().min(1).describe('Line number (1-indexed)'),
    character: z.number().int().min(0).describe('Character position (0-indexed)'),
    includeDeclaration: z.boolean().optional().default(true),
  }),
  handler: async ({ file, line, character, includeDeclaration }: { file: string; line: number; character: number; includeDeclaration?: boolean }) =>
    withLspClient(file, 'find references', async (client) => {
      const locations = await client.references(file, line - 1, character, includeDeclaration);
      if (!locations || locations.length === 0) return 'No references found';
      return `Found ${locations.length} reference(s):\n\n${formatLocations(locations)}`;
    }),
};

// ============================================================
// Tool: lsp_document_symbols
// ============================================================
export const lspDocumentSymbolsTool = {
  name: 'lsp_document_symbols',
  description: 'Get a hierarchical outline of all symbols in a file (functions, classes, variables, etc.).',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
  }),
  handler: async ({ file }: { file: string }) =>
    withLspClient(file, 'document symbols', async (client) => {
      const symbols = await client.documentSymbols(file);
      return formatDocumentSymbols(symbols);
    }),
};

// ============================================================
// Tool: lsp_workspace_symbols
// ============================================================
export const lspWorkspaceSymbolsTool = {
  name: 'lsp_workspace_symbols',
  description: 'Search for symbols across the entire workspace by name.',
  inputSchema: z.object({
    query: z.string().describe('Symbol name to search'),
    file: z.string().describe('Any workspace file (used to find the right language server)'),
  }),
  handler: async ({ query, file }: { query: string; file: string }) =>
    withLspClient(file, 'workspace symbols', async (client) => {
      const symbols = await client.workspaceSymbols(query);
      if (!symbols || symbols.length === 0) return `No symbols found matching: ${query}`;
      return `Found ${symbols.length} symbol(s) matching "${query}":\n\n${formatWorkspaceSymbols(symbols)}`;
    }),
};

// ============================================================
// Tool: lsp_diagnostics
// ============================================================
export const lspDiagnosticsTool = {
  name: 'lsp_diagnostics',
  description: 'Get language server diagnostics (errors, warnings, hints) for a file.',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    severity: z.enum(['error', 'warning', 'info', 'hint']).optional(),
  }),
  handler: async ({ file, severity }: { file: string; severity?: string }) =>
    withLspClient(file, 'diagnostics', async (client) => {
      await client.openDocument(file);
      let diagnostics: any[] = [];
      if (client.supportsPullDiagnostics) {
        diagnostics = await client.pullDiagnostics(file);
      } else {
        await client.waitForDiagnostics(file, 30_000);
        diagnostics = client.getDiagnostics(file);
      }
      if (severity) {
        const severityMap: Record<string, number> = { error: 1, warning: 2, info: 3, hint: 4 };
        diagnostics = diagnostics.filter(d => d.severity === severityMap[severity]);
      }
      if (diagnostics.length === 0) return severity ? `No ${severity} diagnostics in ${file}` : `No diagnostics in ${file}`;
      return `Found ${diagnostics.length} diagnostic(s):\n\n${formatDiagnostics(diagnostics, file)}`;
    }),
};

// ============================================================
// Tool: lsp_servers
// ============================================================
export const lspServersTool = {
  name: 'lsp_servers',
  description: 'List all known language servers and their installation status.',
  inputSchema: z.object({}),
  handler: async () => {
    const servers = getAllServers();
    const installed = servers.filter(s => s.installed);
    const notInstalled = servers.filter(s => !s.installed);

    let text = '## Language Server Status\n\n';
    if (installed.length > 0) {
      text += '### Installed:\n';
      for (const s of installed) {
        text += `- ${s.name} (${s.command})\n  Extensions: ${s.extensions.join(', ')}\n`;
      }
      text += '\n';
    }
    if (notInstalled.length > 0) {
      text += '### Not Installed:\n';
      for (const s of notInstalled) {
        text += `- ${s.name} (${s.command})\n  Extensions: ${s.extensions.join(', ')}\n  Install: ${s.installHint}\n`;
      }
    }
    return { content: [{ type: 'text', text }] };
  },
};

// ============================================================
// Tool: lsp_rename
// ============================================================
export const lspRenameTool = {
  name: 'lsp_rename',
  description: 'Rename a symbol across all files. Returns the list of edits (does NOT apply automatically).',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    line: z.number().int().min(1),
    character: z.number().int().min(0),
    newName: z.string().min(1).describe('New name for the symbol'),
  }),
  handler: async ({ file, line, character, newName }: { file: string; line: number; character: number; newName: string }) =>
    withLspClient(file, 'rename', async (client) => {
      const edit = await client.rename(file, line - 1, character, newName);
      if (!edit) return 'Rename failed or no edits returned';
      const { files, edits } = countEdits(edit);
      return `Rename to "${newName}" would affect ${files} file(s) with ${edits} edit(s):\n\n${formatWorkspaceEdit(edit)}`;
    }),
};

// ============================================================
// Tool: lsp_code_actions
// ============================================================
export const lspCodeActionsTool = {
  name: 'lsp_code_actions',
  description: 'Get available code actions (refactorings, quick fixes) for a selection.',
  inputSchema: z.object({
    file: z.string(),
    startLine: z.number().int().min(1),
    startCharacter: z.number().int().min(0),
    endLine: z.number().int().min(1),
    endCharacter: z.number().int().min(0),
  }),
  handler: async ({ file, startLine, startCharacter, endLine, endCharacter }: { file: string; startLine: number; startCharacter: number; endLine: number; endCharacter: number }) =>
    withLspClient(file, 'code actions', async (client) => {
      const actions = await client.codeActions(file, {
        start: { line: startLine - 1, character: startCharacter },
        end: { line: endLine - 1, character: endCharacter },
      });
      return formatCodeActions(actions);
    }),
};

// ============================================================
// All LSP tools
// ============================================================
export const lspTools = [
  lspHoverTool,
  lspGotoDefinitionTool,
  lspFindReferencesTool,
  lspDocumentSymbolsTool,
  lspWorkspaceSymbolsTool,
  lspDiagnosticsTool,
  lspServersTool,
  lspRenameTool,
  lspCodeActionsTool,
];
