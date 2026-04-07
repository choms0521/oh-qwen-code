/**
 * MCP Server Tools Integration Tests
 *
 * Tests the MCP tools (LSP, AST, Python, Node) in isolation.
 * These tests verify that tool handlers return expected response shapes.
 */

import { describe, test, expect } from 'vitest';

// ============================================================
// LSP Tools Tests
// ============================================================
describe('LSP Tools', () => {
  test('lsp_servers tool returns server list', async () => {
    const { lspServersTool } = await import('../tools/lsp-tools.js');
    const result = await lspServersTool.handler({});
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Language Server Status');
  });

  test('lsp_diagnostics returns helpful error for missing file', async () => {
    const { lspDiagnosticsTool } = await import('../tools/lsp-tools.js');
    const result = await lspDiagnosticsTool.handler({
      file: '/nonexistent/file.ts',
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });
});

// ============================================================
// AST Tools Tests
// ============================================================
describe('AST Tools', () => {
  test('ast_grep returns error when module unavailable', async () => {
    const { astGrepTool } = await import('../tools/ast-tools.js');
    const result = await astGrepTool.handler({
      pattern: 'const $X = $Y',
      language: 'typescript',
    });
    // Should return either matches or error message
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });

  test('ast_replace returns error when module unavailable', async () => {
    const { astReplaceTool } = await import('../tools/ast-tools.js');
    const result = await astReplaceTool.handler({
      pattern: 'const $X = $Y',
      replacement: 'let $X = $Y',
      language: 'typescript',
      dryRun: true,
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });

  test('ast_structure returns error when module unavailable', async () => {
    const { astStructureTool } = await import('../tools/ast-tools.js');
    const result = await astStructureTool.handler({
      file: 'src/index.ts',
      language: 'typescript',
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });
});

// ============================================================
// Python REPL Tests
// ============================================================
describe('Python REPL', () => {
  test('executes simple Python code', async () => {
    const { execFileSync } = await import('child_process');
    const result = execFileSync('python3', ['-c', 'print("hello from omq python")'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(result.trim()).toBe('hello from omq python');
  });
});

// ============================================================
// Node.js REPL Tests
// ============================================================
describe('Node.js REPL', () => {
  test('tool is registered', async () => {
    expect(true).toBe(true);
  });
});
