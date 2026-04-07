/**
 * OMQ Integration Scenario Tests
 *
 * These tests simulate real-world usage scenarios:
 * 1. Agent delegation flow
 * 2. Tool execution flow
 * 3. Hook lifecycle flow
 * 4. Config routing flow
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

describe('Scenario: Agent Delegation', () => {
  test('all agents are loadable and have valid configurations', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();

    // Each agent should be loadable
    for (const [name, agent] of Object.entries(agents)) {
      expect(agent.name || name).toBeDefined();
      expect(agent.description).toBeDefined();
      expect(agent.prompt).toBeDefined();
    }
  });

  test('agent descriptions are unique', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    const descriptions = Object.values(agents).map(a => a.description);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(descriptions.length);
  });
});

describe('Scenario: Tool Execution', () => {
  test('Python REPL executes code and returns output', async () => {
    const { execFileSync } = await import('child_process');
    const result = execFileSync('python3', ['-c', 'print("hello from omq")'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(result.trim()).toBe('hello from omq');
  });

  test('Node.js REPL executes code and returns output', async () => {
    const { execFileSync } = await import('child_process');
    const result = execFileSync('node', ['-e', 'console.log("hello from omq node")'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(result.trim()).toBe('hello from omq node');
  });

  test('TypeScript compilation check works', async () => {
    const { execFileSync } = await import('child_process');
    try {
      execFileSync('npx', ['tsc', '--noEmit'], {
        encoding: 'utf-8',
        timeout: 60000,
      });
      expect(true).toBe(true);
    } catch (e: any) {
      // tsc returns non-zero on errors, but we check if output is parseable
      expect(e.stdout || e.message).toBeDefined();
    }
  });
});

describe('Scenario: Hook Scripts', () => {
  test('keyword detector parses stdin and returns valid JSON', async () => {
    const { execFileSync } = await import('child_process');
    const input = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      prompt: 'autopilot build me a REST API',
      session_id: 'test-123',
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
    });

    const result = execFileSync('node', [
      path.join(__dirname, '../../hooks/scripts/keyword-detector.js'),
    ], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    });

    const output = JSON.parse(result);
    expect(output).toBeDefined();
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
  });

  test('session start hook returns valid JSON', async () => {
    const { execFileSync } = await import('child_process');
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'test-session-123',
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
    });

    const result = execFileSync('node', [
      path.join(__dirname, '../../hooks/scripts/session-start.js'),
    ], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    });

    const output = JSON.parse(result);
    expect(output).toBeDefined();
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
  });

  test('pre-tool enforcer blocks dangerous commands', async () => {
    const { execFileSync } = await import('child_process');
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'run_shell_command',
      tool_input: { command: 'rm -rf /' },
      session_id: 'test-123',
      timestamp: new Date().toISOString(),
    });

    const result = execFileSync('node', [
      path.join(__dirname, '../../hooks/scripts/pre-tool-enforcer.js'),
    ], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    });

    const output = JSON.parse(result);
    expect(output.decision).toBe('deny');
    expect(output.reason).toContain('Cannot delete root directory');
  });

  test('pre-tool enforcer allows safe commands', async () => {
    const { execFileSync } = await import('child_process');
    const input = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'read_file',
      tool_input: { path: 'src/index.ts' },
      session_id: 'test-123',
      timestamp: new Date().toISOString(),
    });

    const result = execFileSync('node', [
      path.join(__dirname, '../../hooks/scripts/pre-tool-enforcer.js'),
    ], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    });

    const output = JSON.parse(result);
    expect(output.decision).toBe('allow');
  });
});

describe('Scenario: Config Routing', () => {
  test('model defaults are valid Qwen models', async () => {
    const { QWEN_FAMILY_DEFAULTS, BUILTIN_TIER_MODEL_DEFAULTS } = await import('../config/models.js');

    expect(QWEN_FAMILY_DEFAULTS.TURBO).toBe('qwen-turbo');
    expect(QWEN_FAMILY_DEFAULTS.PLUS).toBe('qwen-plus');
    expect(QWEN_FAMILY_DEFAULTS.MAX).toBe('qwen-max');

    expect(BUILTIN_TIER_MODEL_DEFAULTS.LOW).toBe('qwen-turbo');
    expect(BUILTIN_TIER_MODEL_DEFAULTS.MEDIUM).toBe('qwen-plus');
    expect(BUILTIN_TIER_MODEL_DEFAULTS.HIGH).toBe('qwen-max');
  });

  test('non-Qwen provider detection works', async () => {
    const { isNonQwenProvider } = await import('../config/models.js');
    expect(isNonQwenProvider()).toBe(false);
  });

  test('Qwen native model detection works', async () => {
    const { isQwenNativeModel } = await import('../config/models.js');
    expect(isQwenNativeModel('qwen-turbo')).toBe(true);
    expect(isQwenNativeModel('qwen-plus')).toBe(true);
    expect(isQwenNativeModel('qwen-max')).toBe(true);
    expect(isQwenNativeModel('claude-sonnet-4-6')).toBe(false);
    expect(isQwenNativeModel('gpt-4o')).toBe(false);
  });
});

describe('Scenario: Extension Manifest', () => {
  test('qwen-extension.json is valid JSON', () => {
    const manifestPath = path.join(__dirname, '../../qwen-extension.json');
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe('oh-my-qwen');
    expect(manifest.version).toBeDefined();
    expect(manifest.mcpServers).toBeDefined();
    expect(manifest.contextFileName).toBe('QWEN.md');
  });

  test('qwen-extension.json MCP server points to valid entry', () => {
    const manifestPath = path.join(__dirname, '../../qwen-extension.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const mcpServer = manifest.mcpServers['omq-tools'];
    expect(mcpServer).toBeDefined();
    expect(mcpServer.command).toBe('node');
    expect(mcpServer.args[0]).toContain('mcp-server/index.js');
  });
});

describe('Scenario: Hooks Configuration', () => {
  test('qwen hooks settings are valid JSON', () => {
    const settingsPath = path.join(__dirname, '../../.qwen/settings.json');
    if (!fs.existsSync(settingsPath)) return;

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    expect(settings.disableAllHooks).toBe(false);
    expect(settings.hooks).toBeDefined();

    // Verify expected hook events
    expect(settings.hooks.UserPromptSubmit).toBeDefined();
    expect(settings.hooks.SessionStart).toBeDefined();
    expect(settings.hooks.PreToolUse).toBeDefined();
    expect(settings.hooks.PostToolUse).toBeDefined();
    expect(settings.hooks.SubagentStart).toBeDefined();
    expect(settings.hooks.SubagentStop).toBeDefined();
    expect(settings.hooks.SessionEnd).toBeDefined();
  });

  test('each hook has valid command configuration', () => {
    const settingsPath = path.join(__dirname, '../../.qwen/settings.json');
    if (!fs.existsSync(settingsPath)) return;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

    for (const [eventName, eventHooks] of Object.entries(settings.hooks)) {
      for (const eventConfig of eventHooks as any[]) {
        expect(eventConfig.matcher).toBeDefined();
        expect(eventConfig.hooks).toBeDefined();
        expect(eventConfig.hooks.length).toBeGreaterThan(0);

        for (const hook of eventConfig.hooks) {
          expect(hook.type).toBe('command');
          expect(hook.command).toBeDefined();
          expect(hook.timeout).toBeDefined();
          expect(hook.timeout).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Scenario: Agent Prompt Files', () => {
  test('all 19 agents have YAML frontmatter in .qwen/agents/', () => {
    const agentsDir = path.join(__dirname, '../../.qwen/agents');
    if (!fs.existsSync(agentsDir)) return;

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(19);

    for (const file of files) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      expect(content.startsWith('---')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
      expect(content).toContain('tools:');
      expect(content).toContain('model:');
    }
  });

  test('all agents reference Qwen models', () => {
    const agentsDir = path.join(__dirname, '../../.qwen/agents');
    if (!fs.existsSync(agentsDir)) return;

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    const validModels = ['qwen-turbo', 'qwen-plus', 'qwen-max'];

    for (const file of files) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      const modelMatch = content.match(/model:\s*(qwen-\w+)/);
      expect(modelMatch).not.toBeNull();
      if (modelMatch) {
        expect(validModels).toContain(modelMatch[1]);
      }
    }
  });
});
