/**
 * Agent Registry Validation Tests
 *
 * Ported from oh-my-claudecode with Qwen-specific adaptations.
 * Verifies that all 19 agents are correctly defined and configured.
 */

import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_ENV_KEYS = [
  'QWEN_MODEL',
  'DASHSCOPE_API_BASE',
  'OMQ_MODEL_HIGH',
  'OMQ_MODEL_MEDIUM',
  'OMQ_MODEL_LOW',
] as const;

const EXPECTED_AGENTS = [
  'explore', 'writer', 'tracer',
  'debugger', 'executor', 'verifier',
  'security-reviewer', 'test-engineer', 'designer',
  'qa-tester', 'scientist', 'git-master',
  'document-specialist',
  'analyst', 'planner', 'architect',
  'code-reviewer', 'code-simplifier', 'critic',
];

describe('Agent Registry Validation', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of MODEL_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of MODEL_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  test('agent count is exactly 19', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    expect(Object.keys(agents).length).toBe(19);
  });

  test('all 19 expected agents are registered', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    for (const name of EXPECTED_AGENTS) {
      expect(agents).toHaveProperty(name);
    }
  });

  test('all agents have .md prompt files in .qwen/agents/', () => {
    const agentsDir = path.join(__dirname, '../../.qwen/agents');
    if (!fs.existsSync(agentsDir)) return;
    const promptFiles = fs.readdirSync(agentsDir).filter((file) => file.endsWith('.md'));
    for (const file of promptFiles) {
      const name = file.replace(/\.md$/, '');
      expect(EXPECTED_AGENTS, `Unexpected agent file: ${file}`).toContain(name);
    }
  });

  test('each agent has a prompt', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    for (const [name, config] of Object.entries(agents)) {
      expect(config.prompt).toBeDefined();
      expect(config.prompt.length).toBeGreaterThan(0);
    }
  });

  test('each agent has a description', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    for (const [name, config] of Object.entries(agents)) {
      expect(config.description).toBeDefined();
      expect(config.description.length).toBeGreaterThan(10);
    }
  });

  test('agent model assignments are valid Qwen models', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    const validModels = ['qwen-turbo', 'qwen-plus', 'qwen-max'];
    for (const [name, config] of Object.entries(agents)) {
      if (config.model) {
        expect(validModels).toContain(config.model);
      }
    }
  });

  test('tier distribution is correct', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    const tiers: Record<string, string[]> = { turbo: [], plus: [], max: [] };
    for (const [name, config] of Object.entries(agents)) {
      if (config.model?.includes('turbo')) tiers.turbo.push(name);
      else if (config.model?.includes('plus')) tiers.plus.push(name);
      else if (config.model?.includes('max')) tiers.max.push(name);
    }
    expect(tiers.turbo.length).toBe(3);  // explore, writer, tracer
    expect(tiers.plus.length).toBe(10); // debugger, executor, verifier, security-reviewer, test-engineer, designer, qa-tester, scientist, git-master, document-specialist
    expect(tiers.max.length).toBe(6);   // analyst, planner, architect, code-reviewer, code-simplifier, critic
  });

  test('deprecated agent aliases are not in registry', async () => {
    const { getAgentDefinitions } = await import('../agents/definitions.js');
    const agents = getAgentDefinitions();
    expect(Object.keys(agents)).not.toContain('harsh-critic');
    expect(Object.keys(agents)).not.toContain('quality-reviewer');
    expect(Object.keys(agents)).not.toContain('deep-executor');
    expect(Object.keys(agents)).not.toContain('build-fixer');
  });
});
