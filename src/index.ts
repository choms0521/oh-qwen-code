/**
 * Oh My Qwen - Index
 *
 * Main entry point for the OMQ extension.
 * Re-exports configuration utilities and helpers.
 */

export { loadConfig, buildDefaultConfig } from './config/loader.js';
export {
  getDefaultTierModels,
  QWEN_FAMILY_DEFAULTS,
  BUILTIN_TIER_MODEL_DEFAULTS,
} from './config/models.js';
export type { PluginConfig, AgentConfig, ModelType } from './shared/types.js';

/**
 * Create OMQ session for Qwen Code
 */
export async function createOmqSession(_options: Record<string, unknown> = {}) {
  // OMQ uses Qwen Code's native Task tool for agent delegation.
  // No explicit session creation needed - agents are invoked via Task tool.
  return { status: 'ready' };
}
