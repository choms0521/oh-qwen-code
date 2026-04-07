// SSRF validation removed

export type ModelTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type QwenModelFamily = 'TURBO' | 'PLUS' | 'MAX';

const TIER_ENV_KEYS: Record<ModelTier, readonly string[]> = {
  LOW: ['OMQ_MODEL_LOW', 'QWEN_DEFAULT_TURBO_MODEL'],
  MEDIUM: ['OMQ_MODEL_MEDIUM', 'QWEN_DEFAULT_PLUS_MODEL'],
  HIGH: ['OMQ_MODEL_HIGH', 'QWEN_DEFAULT_MAX_MODEL'],
};

/**
 * Canonical Qwen family defaults.
 */
export const QWEN_FAMILY_DEFAULTS: Record<QwenModelFamily, string> = {
  TURBO: 'qwen-turbo',
  PLUS: 'qwen-plus',
  MAX: 'qwen-max',
};

/** Canonical tier->model mapping used as built-in defaults */
export const BUILTIN_TIER_MODEL_DEFAULTS: Record<ModelTier, string> = {
  LOW: QWEN_FAMILY_DEFAULTS.TURBO,
  MEDIUM: QWEN_FAMILY_DEFAULTS.PLUS,
  HIGH: QWEN_FAMILY_DEFAULTS.MAX,
};

/**
 * Centralized Model ID Constants
 *
 * Environment variables (highest precedence):
 *   OMQ_MODEL_HIGH    - Model ID for HIGH tier (max-class)
 *   OMQ_MODEL_MEDIUM  - Model ID for MEDIUM tier (plus-class)
 *   OMQ_MODEL_LOW     - Model ID for LOW tier (turbo-class)
 */

/**
 * Resolve the default model ID for a tier.
 *
 * Resolution order:
 * 1. OMQ tier env vars (OMQ_MODEL_HIGH / OMQ_MODEL_MEDIUM / OMQ_MODEL_LOW)
 * 2. Qwen provider env vars
 * 3. Built-in fallback
 */
export function getDefaultTierModels(): Record<ModelTier, string> {
  const result = {} as Record<ModelTier, string>;

  for (const [tier, envKeys] of Object.entries(TIER_ENV_KEYS) as [ModelTier, readonly string[]][]) {
    let modelId: string | undefined;
    for (const key of envKeys) {
      const val = process.env[key]?.trim();
      if (val) {
        modelId = val;
        break;
      }
    }
    result[tier] = modelId ?? BUILTIN_TIER_MODEL_DEFAULTS[tier];
  }

  return result;
}

/**
 * Detect whether Qwen Code is running on DashScope.
 */
export function isDashScopeProvider(modelId?: string): boolean {
  if (modelId && /^dashscope\./i.test(modelId)) return true;
  const baseUrl = process.env.DASHSCOPE_API_BASE?.trim();
  if (baseUrl) return true;
  return false;
}

/**
 * Detect whether OMQ should avoid passing Qwen-specific model tier names.
 */
export function isNonQwenProvider(): boolean {
  return isDashScopeProvider(process.env.QWEN_MODEL);
}

/**
 * Detect whether a model ID has a Qwen Code extended-context window suffix like [200k]
 */
export function hasExtendedContextSuffix(modelId: string): boolean {
  return /\[\d+[kKmM]\]$/.test(modelId);
}

/**
 * Detect whether a model ID is Qwen-native (not from another provider)
 */
export function isQwenNativeModel(modelId: string): boolean {
  const base = modelId.replace(/\[.*\]$/, '');
  return /^qwen-(turbo|plus|max|long|coder|vl)/i.test(base);
}
