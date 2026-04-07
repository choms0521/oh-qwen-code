/**
 * Config Loader Tests
 *
 * Ported from oh-my-claudecode with Qwen-specific adaptations.
 * Verifies configuration loading and model routing.
 */

import { beforeEach, afterEach, describe, test, expect } from 'vitest';

describe('Config Loader', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    const keys = ['OMQ_MODEL_HIGH', 'OMQ_MODEL_MEDIUM', 'OMQ_MODEL_LOW', 'QWEN_MODEL'];
    for (const key of keys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  test('buildDefaultConfig returns valid structure', async () => {
    const { buildDefaultConfig } = await import('../config/loader.js');
    const config = buildDefaultConfig();
    expect(config).toHaveProperty('agents');
    expect(config).toHaveProperty('features');
    expect(config).toHaveProperty('routing');
  });

  test('default config has agents configured', async () => {
    const { buildDefaultConfig } = await import('../config/loader.js');
    const config = buildDefaultConfig();
    const agentKeys = Object.keys(config.agents || {});
    expect(agentKeys.length).toBeGreaterThan(10);
  });

  test('features are enabled by default', async () => {
    const { buildDefaultConfig } = await import('../config/loader.js');
    const config = buildDefaultConfig();
    expect(config.features?.parallelExecution).toBe(true);
    expect(config.features?.continuationEnforcement).toBe(true);
  });

  test('routing is enabled by default', async () => {
    const { buildDefaultConfig } = await import('../config/loader.js');
    const config = buildDefaultConfig();
    expect(config.routing?.enabled).toBe(true);
  });
});
