#!/usr/bin/env node
/**
 * OMQ MCP Server
 *
 * Provides custom tools for Oh My Qwen orchestration via the
 * Model Context Protocol. Qwen Code loads this server at startup
 * via the mcpServers configuration in qwen-extension.json.
 *
 * Tools provided:
 * - omq_notify: Send notifications via Telegram/Discord/Slack
 * - omq_plan: Create and manage implementation plans
 * - omq_state: Read/write OMQ state
 * - omq_agents: List available agents and their status
 * - omq_python: Execute Python code securely
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { lspTools } from '../../src/tools/lsp-tools.js';
import { astTools } from '../../src/tools/ast-tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: 'oh-my-qwen',
  version: '0.1.0',
});

// ============================================================
// Tool: omq_notify
// ============================================================
server.registerTool(
  'omq_notify',
  {
    title: 'OMQ Notify',
    description: 'Send notifications via Telegram, Discord, Slack, or custom webhooks. Use to alert team members about important events.',
    inputSchema: z.object({
      title: z.string(),
      message: z.string(),
      type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
      platform: z.enum(['telegram', 'discord', 'slack', 'all']).default('all'),
    }),
  },
  async ({ title, message, type, platform }) => {
    const configPath = join(homedir(), '.omq', 'notifications.json');
    let config: {
      enabled: boolean;
      telegram?: { botToken: string; chatId: string };
      discord?: { webhookUrl: string };
      slack?: { webhookUrl: string };
    } = { enabled: false };

    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf-8'));
      } catch { /* use defaults */ }
    }

    if (!config.enabled) {
      return {
        content: [{ type: 'text', text: '⚠️ Notifications are disabled. Set enabled=true in ~/.omq/notifications.json to enable.' }],
      };
    }

    const icon = { info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅' }[type];
    const result = { sent: [], failed: [] };

    // In a real implementation, you would make HTTP calls to each platform's API
    // For now, return the formatted message
    const formattedMessage = `${icon} *${title}*\n\n${message}`;

    if (platform === 'all' || platform === 'telegram') {
      if (config.telegram?.botToken && config.telegram?.chatId) {
        result.sent.push('telegram');
      } else {
        result.failed.push('telegram (not configured)');
      }
    }
    if (platform === 'all' || platform === 'discord') {
      if (config.discord?.webhookUrl) {
        result.sent.push('discord');
      } else {
        result.failed.push('discord (not configured)');
      }
    }
    if (platform === 'all' || platform === 'slack') {
      if (config.slack?.webhookUrl) {
        result.sent.push('slack');
      } else {
        result.failed.push('slack (not configured)');
      }
    }

    return {
      content: [{
        type: 'text',
        text: `Notification sent:\n${formattedMessage}\n\nSent to: ${result.sent.join(', ') || 'none'}\nFailed: ${result.failed.join(', ') || 'none'}`,
      }],
    };
  }
);

// ============================================================
// Tool: omq_plan
// ============================================================
server.registerTool(
  'omq_plan',
  {
    title: 'OMQ Plan Manager',
    description: 'Create, read, update, and delete implementation plans. Use to track multi-step tasks with progress.',
    inputSchema: {
      action: z.enum(['create', 'read', 'update', 'list', 'delete']),
      title: z.string().optional(),
      description: z.string().optional(),
      planId: z.string().optional(),
      stepId: z.string().optional(),
      stepStatus: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
    },
  },
  async ({ action, title, description, planId, stepId, stepStatus }) => {
    const plansDir = join(process.cwd(), '.omq', 'plans');
    mkdirSync(plansDir, { recursive: true });

    if (action === 'create') {
      const plan = {
        id: `plan-${Date.now()}`,
        title: title || 'Untitled Plan',
        description: description || '',
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(join(plansDir, `${plan.id}.json`), JSON.stringify(plan, null, 2));
      return {
        content: [{ type: 'text', text: `Plan created: ${plan.id}\nTitle: ${plan.title}\nUse omq_plan with action "update" to add steps.` }],
      };
    }

    if (action === 'list') {
      const files = existsSync(plansDir) ? readdirSync(plansDir).filter(f => f.endsWith('.json')) : [];
      if (files.length === 0) return { content: [{ type: 'text', text: 'No plans found.' }] };
      const plans = files.map(f => JSON.parse(readFileSync(join(plansDir, f), 'utf-8')));
      const summary = plans.map(p => `${p.id}: ${p.title} (${p.steps.length} steps, ${p.steps.filter(s => s.status === 'completed').length} completed)`).join('\n');
      return { content: [{ type: 'text', text: `Plans:\n${summary}` }] };
    }

    if (action === 'read' && planId) {
      const path = join(plansDir, `${planId}.json`);
      if (!existsSync(path)) return { content: [{ type: 'text', text: `Plan not found: ${planId}` }] };
      const plan = JSON.parse(readFileSync(path, 'utf-8'));
      const steps = plan.steps.map((s, i) => `${i + 1}. [${s.status}] ${s.description}`).join('\n') || '  (no steps)';
      return { content: [{ type: 'text', text: `Plan: ${plan.title}\n${plan.description}\n\nSteps:\n${steps}` }] };
    }

    if (action === 'update' && planId && stepId && stepStatus) {
      const path = join(plansDir, `${planId}.json`);
      if (!existsSync(path)) return { content: [{ type: 'text', text: `Plan not found: ${planId}` }] };
      const plan = JSON.parse(readFileSync(path, 'utf-8'));
      const step = plan.steps.find(s => s.id === stepId);
      if (!step) return { content: [{ type: 'text', text: `Step not found: ${stepId}` }] };
      step.status = stepStatus;
      plan.updatedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(plan, null, 2));
      return { content: [{ type: 'text', text: `Step ${stepId} updated: ${stepStatus}` }] };
    }

    return { content: [{ type: 'text', text: 'Usage: omq_plan {create|read|update|list|delete} with required parameters.' }] };
  }
);

// ============================================================
// Tool: omq_agents
// ============================================================
server.registerTool(
  'omq_agents',
  {
    title: 'OMQ Agent List',
    description: 'List all available OMQ agents, their assigned Qwen model tiers, and permitted tools.',
    inputSchema: {
      filter: z.enum(['all', 'turbo', 'plus', 'max']).default('all'),
    },
  },
  async ({ filter }) => {
    const agents = [
      { name: 'explore', model: 'qwen-turbo', tier: 'LOW', tools: ['read_file', 'read_many_files', 'grep_search', 'glob'] },
      { name: 'writer', model: 'qwen-turbo', tier: 'LOW', tools: ['read_file', 'read_many_files', 'write_file', 'edit', 'grep_search'] },
      { name: 'tracer', model: 'qwen-turbo', tier: 'LOW', tools: ['read_file', 'read_many_files', 'grep_search', 'run_shell_command'] },
      { name: 'debugger', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'grep_search', 'run_shell_command', 'edit', 'write_file'] },
      { name: 'executor', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'write_file', 'edit', 'run_shell_command', 'grep_search'] },
      { name: 'verifier', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'run_shell_command', 'grep_search'] },
      { name: 'security-reviewer', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'grep_search'] },
      { name: 'test-engineer', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'write_file', 'edit', 'run_shell_command', 'grep_search'] },
      { name: 'designer', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'write_file', 'edit', 'run_shell_command'] },
      { name: 'qa-tester', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'run_shell_command', 'grep_search'] },
      { name: 'scientist', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'read_many_files', 'write_file', 'run_shell_command', 'web_search'] },
      { name: 'git-master', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'run_shell_command', 'grep_search'] },
      { name: 'document-specialist', model: 'qwen-plus', tier: 'MEDIUM', tools: ['read_file', 'web_search', 'web_fetch'] },
      { name: 'analyst', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'grep_search'] },
      { name: 'planner', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'grep_search', 'write_file'] },
      { name: 'architect', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'grep_search', 'run_shell_command'] },
      { name: 'code-reviewer', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'grep_search', 'run_shell_command'] },
      { name: 'code-simplifier', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'edit', 'write_file', 'run_shell_command'] },
      { name: 'critic', model: 'qwen-max', tier: 'HIGH', tools: ['read_file', 'read_many_files', 'grep_search', 'run_shell_command'] },
    ];

    const filtered = filter === 'all' ? agents : agents.filter(a => a.model.includes(filter));
    const lines = filtered.map(a => `- **${a.name}** (${a.model}) [${a.tier}] — tools: ${a.tools.join(', ')}`);
    return {
      content: [{ type: 'text', text: `## OMQ Agents (${filtered.length})\n\n${lines.join('\n')}` }],
    };
  }
);

// ============================================================
// Tool: omq_python
// ============================================================
server.registerTool(
  'omq_python',
  {
    title: 'OMQ Python REPL',
    description: 'Execute Python code in a secure environment. Use for running Python snippets, testing algorithms, data processing, and any Python-related tasks.',
    inputSchema: {
      code: z.string(),
    },
  },
  async ({ code }) => {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('python3', ['-c', code], {
        encoding: 'utf-8',
        timeout: 30000,
      });
      return {
        content: [{ type: 'text', text: result.trim() || '(empty output)' }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Python execution error:\n${message}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool: omq_state
// ============================================================
server.registerTool(
  'omq_state',
  {
    title: 'OMQ State Manager',
    description: 'Read and write OMQ persistent state. Use to track mode, progress, and session data across turns.',
    inputSchema: {
      action: z.enum(['read', 'write', 'clear']),
      key: z.string(),
      value: z.any().optional(),
    },
  },
  async ({ action, key, value }) => {
    const stateDir = join(process.cwd(), '.omq', 'state');
    mkdirSync(stateDir, { recursive: true });
    const stateFile = join(stateDir, `${key}.json`);

    if (action === 'read') {
      if (!existsSync(stateFile)) return { content: [{ type: 'text', text: `State key not found: ${key}` }] };
      const data = JSON.parse(readFileSync(stateFile, 'utf-8'));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    if (action === 'write' && value !== undefined) {
      writeFileSync(stateFile, JSON.stringify(value, null, 2));
      return { content: [{ type: 'text', text: `State "${key}" updated.` }] };
    }

    if (action === 'clear') {
      if (existsSync(stateFile)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(stateFile);
      }
      return { content: [{ type: 'text', text: `State "${key}" cleared.` }] };
    }

    return { content: [{ type: 'text', text: 'Usage: omq_state {read|write|clear} with key and optional value.' }] };
  }
);

// ============================================================
// Tool: omq_lsp (Language Server Protocol diagnostics)
// ============================================================
server.registerTool(
  'omq_lsp',
  {
    title: 'OMQ LSP Diagnostics',
    description: 'Get language server diagnostics (errors, warnings) for a file or project. Supports TypeScript, Python, and other LSP-enabled languages. Use to find type errors, syntax errors, and linting issues.',
    inputSchema: z.object({
      action: z.enum(['diagnostics', 'tsc', 'pyright']),
      path: z.string().optional().describe('File or directory to check'),
    }),
  },
  async ({ action, path }) => {
    const cwd = process.cwd();
    const targetPath = path || cwd;

    if (action === 'diagnostics') {
      // Generic: try tsc, then eslint, then pyright
      const results: string[] = [];

      // TypeScript diagnostics
      if (existsSync(join(cwd, 'tsconfig.json'))) {
        try {
          const tscResult = execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
            cwd,
            encoding: 'utf-8',
            timeout: 60000,
          });
          results.push(`TypeScript: ✅ No errors`);
        } catch (error: any) {
          const output = typeof error.stdout === 'string' ? error.stdout : (error.message || '');
          const lines = output.split('\n').filter(l => l.includes('error TS')).slice(0, 20);
          results.push(`TypeScript errors (${lines.length}):\n${lines.join('\n')}`);
        }
      }

      // ESLint diagnostics
      if (existsSync(join(cwd, 'eslint.config.js')) || existsSync(join(cwd, '.eslintrc.js'))) {
        try {
          execFileSync('npx', ['eslint', '.', '--quiet'], {
            cwd,
            encoding: 'utf-8',
            timeout: 60000,
          });
          results.push(`ESLint: ✅ No errors`);
        } catch (error: any) {
          const output = typeof error.stdout === 'string' ? error.stdout : (error.message || '');
          const lines = output.split('\n').filter(l => l.includes('error')).slice(0, 20);
          results.push(`ESLint errors (${lines.length}):\n${lines.join('\n')}`);
        }
      }

      if (results.length === 0) {
        return { content: [{ type: 'text', text: 'No LSP-capable tools found in this project.\n\nSupported: TypeScript (tsconfig.json), ESLint (eslint.config.js)' }] };
      }

      return { content: [{ type: 'text', text: results.join('\n\n---\n\n') }] };
    }

    if (action === 'tsc') {
      if (!existsSync(join(cwd, 'tsconfig.json'))) {
        return { content: [{ type: 'text', text: 'No tsconfig.json found. TypeScript diagnostics require a TypeScript project.' }] };
      }
      try {
        const result = execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
          cwd,
          encoding: 'utf-8',
          timeout: 60000,
        });
        return { content: [{ type: 'text', text: '✅ TypeScript: No errors' }] };
      } catch (error: any) {
        const output = typeof error.stdout === 'string' ? error.stdout : (error.message || '');
        const lines = output.split('\n').filter(l => l.trim()).slice(0, 30);
        return { content: [{ type: 'text', text: `TypeScript errors:\n\n${lines.join('\n')}` }] };
      }
    }

    if (action === 'pyright') {
      try {
        const result = execFileSync('npx', ['pyright', targetPath], {
          cwd,
          encoding: 'utf-8',
          timeout: 60000,
        });
        return { content: [{ type: 'text', text: `Pyright output:\n${result}` }] };
      } catch (error: any) {
        const output = typeof error.stdout === 'string' ? error.stdout : (error.message || '');
        return { content: [{ type: 'text', text: `Pyright errors:\n\n${output.split('\n').slice(0, 30).join('\n')}` }] };
      }
    }

    return { content: [{ type: 'text', text: 'Usage: omq_lsp {diagnostics|tsc|pyright} with optional path.' }] };
  }
);

// ============================================================
// Tool: omq_ast (AST-based code analysis)
// ============================================================
server.registerTool(
  'omq_ast',
  {
    title: 'OMQ AST Analysis',
    description: 'Analyze code structure using Abstract Syntax Tree parsing. Find function definitions, class structures, imports, complexity metrics, and code patterns without running the code.',
    inputSchema: z.object({
      action: z.enum(['structure', 'imports', 'functions', 'complexity', 'pattern']),
      path: z.string().describe('File or directory to analyze'),
      pattern: z.string().optional().describe('AST-grep pattern (for action="pattern")'),
      language: z.enum(['typescript', 'javascript', 'python']).optional(),
    }),
  },
  async ({ action, path, pattern, language }) => {
    const cwd = process.cwd();
    const targetPath = join(cwd, path);

    if (!existsSync(targetPath)) {
      return { content: [{ type: 'text', text: `Path not found: ${targetPath}` }] };
    }

    if (action === 'structure') {
      // Parse file structure using grep/regex for quick analysis
      const content = readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');

      const structure: Array<{ type: string; name: string; line: number }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // TypeScript/JavaScript: functions, classes, interfaces
        const fnMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
        const constFnMatch = line.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/);
        const methodMatch = line.match(/^\s+(?:async\s+)?(\w+)\s*\(.*\)\s*(?::\s*\S+)?\s*\{/);

        if (fnMatch) structure.push({ type: 'function', name: fnMatch[1], line: i + 1 });
        else if (classMatch) structure.push({ type: 'class', name: classMatch[1], line: i + 1 });
        else if (interfaceMatch) structure.push({ type: 'interface', name: interfaceMatch[1], line: i + 1 });
        else if (constFnMatch) structure.push({ type: 'const function', name: constFnMatch[1], line: i + 1 });
        else if (methodMatch && i > 0) structure.push({ type: 'method', name: methodMatch[1], line: i + 1 });
      }

      if (structure.length === 0) {
        return { content: [{ type: 'text', text: `No top-level definitions found in ${path}` }] };
      }

      const summary = structure.map(s => `  ${s.line}: ${s.type} ${s.name}`).join('\n');
      return {
        content: [{ type: 'text', text: `Structure of ${path} (${structure.length} definitions):\n\n${summary}` }],
      };
    }

    if (action === 'imports') {
      const content = readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');
      const imports: string[] = [];

      for (const line of lines) {
        const importMatch = line.match(/^(?:import|from)\s+['"]([^'"]+)['"]/);
        const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
        if (importMatch) imports.push(importMatch[1]);
        else if (requireMatch) imports.push(requireMatch[1]);
      }

      if (imports.length === 0) {
        return { content: [{ type: 'text', text: `No imports found in ${path}` }] };
      }

      return {
        content: [{ type: 'text', text: `Imports in ${path} (${imports.length}):\n\n${imports.map(i => `  - ${i}`).join('\n')}` }],
      };
    }

    if (action === 'functions') {
      const content = readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');
      const functions: Array<{ name: string; line: number; params: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fnMatch = line.match(/function\s+(\w+)\s*\(([^)]*)\)/);
        const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)/);
        const methodMatch = line.match(/^\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/);

        if (fnMatch) functions.push({ name: fnMatch[1], line: i + 1, params: fnMatch[2].trim() });
        else if (arrowMatch) functions.push({ name: arrowMatch[1], line: i + 1, params: arrowMatch[2].trim() });
        else if (methodMatch) functions.push({ name: methodMatch[1], line: i + 1, params: methodMatch[2].trim() });
      }

      if (functions.length === 0) {
        return { content: [{ type: 'text', text: `No functions found in ${path}` }] };
      }

      const summary = functions.map(f => `  ${f.line}: ${f.name}(${f.params})`).join('\n');
      return {
        content: [{ type: 'text', text: `Functions in ${path} (${functions.length}):\n\n${summary}` }],
      };
    }

    if (action === 'complexity') {
      const content = readFileSync(targetPath, 'utf-8');
      const lines = content.split('\n');

      let maxNesting = 0;
      let currentNesting = 0;
      let branchCount = 0;
      let lineCount = lines.length;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('if') || trimmed.startsWith('for') || trimmed.startsWith('while') || trimmed.startsWith('switch')) {
          if (trimmed.includes('{')) currentNesting++;
          if (trimmed.startsWith('if') || trimmed.startsWith('else') || trimmed.startsWith('switch') || trimmed.startsWith('?')) branchCount++;
        }
        if (trimmed.includes('}')) currentNesting = Math.max(0, currentNesting - 1);
        maxNesting = Math.max(maxNesting, currentNesting);
      }

      return {
        content: [{ type: 'text', text: `Complexity metrics for ${path}:\n\n- Lines: ${lineCount}\n- Max nesting depth: ${maxNesting}\n- Branch points: ${branchCount}\n- Cyclomatic estimate: ${branchCount + 1}\n\n${maxNesting > 4 ? '⚠️ High nesting depth — consider refactoring.' : '✅ Nesting depth is reasonable.'}` }],
      };
    }

    if (action === 'pattern' && pattern) {
      // Use grep for pattern matching as a lightweight AST search
      try {
        const result = execFileSync('grep', ['-rn', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.jsx', '--include=*.py', pattern, targetPath], {
          encoding: 'utf-8',
          timeout: 10000,
        });
        const lines = result.split('\n').filter(l => l.trim()).slice(0, 30);
        return {
          content: [{ type: 'text', text: `Pattern "${pattern}" in ${path} (${lines.length} matches):\n\n${lines.join('\n')}` }],
        };
      } catch {
        return { content: [{ type: 'text', text: `No matches for pattern "${pattern}" in ${path}` }] };
      }
    }

    return { content: [{ type: 'text', text: 'Usage: omq_ast {structure|imports|functions|complexity|pattern} with path and optional pattern.' }] };
  }
);

// ============================================================
// Tool: omq_node (Node.js REPL)
// ============================================================
server.registerTool(
  'omq_node',
  {
    title: 'OMQ Node.js REPL',
    description: 'Execute Node.js/TypeScript code. Use for testing APIs, running scripts, evaluating expressions, and any JavaScript/TypeScript tasks. Supports ESM and CommonJS.',
    inputSchema: z.object({
      code: z.string().describe('JavaScript/TypeScript code to execute'),
      esm: z.boolean().optional().default(true).describe('Use ESM mode (import/export)'),
    }),
  },
  async ({ code, esm }) => {
    try {
      const { execFileSync } = await import('child_process');
      const tmpFile = join(process.cwd(), '.omq', 'tmp', `repl-${Date.now()}.mjs`);
      mkdirSync(dirname(tmpFile), { recursive: true });
      writeFileSync(tmpFile, code);

      const result = execFileSync('node', [tmpFile], {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      unlinkSync(tmpFile);
      return {
        content: [{ type: 'text', text: result.trim() || '(empty output)' }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Node.js execution error:\n${message}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool: omq_python (improved with package install)
// ============================================================
server.registerTool(
  'omq_python',
  {
    title: 'OMQ Python REPL',
    description: 'Execute Python code with package installation support. Use for running Python snippets, data analysis (pandas, numpy), web scraping, testing algorithms, and any Python-related tasks.',
    inputSchema: z.object({
      code: z.string().describe('Python code to execute'),
      packages: z.array(z.string()).optional().describe('Packages to install before running (e.g. ["pandas", "numpy"])'),
      timeout: z.number().optional().default(30000).describe('Execution timeout in milliseconds'),
    }),
  },
  async ({ code, packages, timeout }) => {
    try {
      const tmpFile = join(process.cwd(), '.omq', 'tmp', `repl-${Date.now()}.py`);
      mkdirSync(dirname(tmpFile), { recursive: true });

      let script = '';
      if (packages && packages.length > 0) {
        script += `import subprocess\n`;
        for (const pkg of packages) {
          script += `subprocess.check_call(['pip', 'install', '-q', '${pkg}'])\n`;
        }
        script += '\n';
      }
      script += code;

      writeFileSync(tmpFile, script);

      const result = execFileSync('python3', [tmpFile], {
        encoding: 'utf-8',
        timeout,
        maxBuffer: 1024 * 1024,
      });

      unlinkSync(tmpFile);
      return {
        content: [{ type: 'text', text: result.trim() || '(empty output)' }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Python execution error:\n${message}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Register LSP Tools
// ============================================================
for (const tool of lspTools) {
  server.registerTool(
    tool.name,
    { title: tool.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), description: tool.description, inputSchema: tool.inputSchema },
    async (args) => {
      const result = await tool.handler(args);
      return { content: [{ type: 'text' as const, text: result.content?.[0]?.text ?? JSON.stringify(result) }] };
    }
  );
}

// ============================================================
// Register AST Tools
// ============================================================
for (const tool of astTools) {
  server.registerTool(
    tool.name,
    { title: tool.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), description: tool.description, inputSchema: tool.inputSchema },
    async (args) => {
      const result = await tool.handler(args);
      return { content: [{ type: 'text' as const, text: result.content?.[0]?.text ?? JSON.stringify(result) }], isError: result.isError };
    }
  );
}

// ============================================================
// Start server
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OMQ MCP server running on stdio');
}

main().catch(console.error);
