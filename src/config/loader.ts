/**
 * Configuration Loader
 *
 * Handles loading and merging configuration from multiple sources:
 * - User config: ~/.config/qwen-omq/config.jsonc
 * - Project config: .qwen/omq.jsonc
 * - Environment variables
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { PluginConfig } from "../shared/types.js";
import { getConfigDir } from "../utils/config-dir.js";
import { parseJsonc } from "../utils/jsonc.js";
import {
  getDefaultTierModels,
  BUILTIN_TIER_MODEL_DEFAULTS,
} from "./models.js";

export function buildDefaultConfig(): PluginConfig {
  const defaultTierModels = getDefaultTierModels();

  return {
    agents: {
      omq: { model: defaultTierModels.HIGH },
      explore: { model: defaultTierModels.LOW },
      analyst: { model: defaultTierModels.HIGH },
      planner: { model: defaultTierModels.HIGH },
      architect: { model: defaultTierModels.HIGH },
      debugger: { model: defaultTierModels.MEDIUM },
      executor: { model: defaultTierModels.MEDIUM },
      verifier: { model: defaultTierModels.MEDIUM },
      securityReviewer: { model: defaultTierModels.MEDIUM },
      codeReviewer: { model: defaultTierModels.HIGH },
      testEngineer: { model: defaultTierModels.MEDIUM },
      designer: { model: defaultTierModels.MEDIUM },
      writer: { model: defaultTierModels.LOW },
      qaTester: { model: defaultTierModels.MEDIUM },
      scientist: { model: defaultTierModels.MEDIUM },
      tracer: { model: defaultTierModels.MEDIUM },
      gitMaster: { model: defaultTierModels.MEDIUM },
      codeSimplifier: { model: defaultTierModels.HIGH },
      critic: { model: defaultTierModels.HIGH },
      documentSpecialist: { model: defaultTierModels.MEDIUM },
    },
    features: {
      parallelExecution: true,
      lspTools: true,
      astTools: true,
      continuationEnforcement: true,
      autoContextInjection: true,
    },
    mcpServers: {},
    permissions: {
      allowBash: true,
      allowEdit: true,
      allowWrite: true,
      maxBackgroundTasks: 5,
    },
    routing: {
      enabled: true,
      defaultTier: "MEDIUM",
      forceInherit: false,
      escalationEnabled: true,
      maxEscalations: 2,
      tierModels: { ...defaultTierModels },
    },
    notifications: {
      enabled: false,
    },
  };
}

function deepMerge(target: any, source: any): any {
  if (!source) return target;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] ?? {}, source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

export function loadConfig(): PluginConfig {
  const defaults = buildDefaultConfig();
  const configDir = getConfigDir();

  const userConfigPath = join(configDir, 'qwen-omq', 'config.jsonc');
  const projectConfigPath = join(process.cwd(), '.qwen', 'omq.jsonc');

  let config = defaults;

  if (existsSync(userConfigPath)) {
    try {
      const raw = readFileSync(userConfigPath, 'utf-8');
      const userConfig = parseJsonc(raw) as PluginConfig;
      config = deepMerge(config, userConfig);
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  if (existsSync(projectConfigPath)) {
    try {
      const raw = readFileSync(projectConfigPath, 'utf-8');
      const projectConfig = parseJsonc(raw) as PluginConfig;
      config = deepMerge(config, projectConfig);
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  return config;
}
