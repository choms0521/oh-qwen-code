import { homedir } from 'os';
import { join } from 'path';

/**
 * Get the Qwen Code config directory.
 * Resolution order:
 * 1. QWEN_CONFIG_DIR env var
 * 2. ~/.qwen/
 */
export function getConfigDir(): string {
  const envDir = process.env.QWEN_CONFIG_DIR?.trim();
  if (envDir) return envDir;
  return join(homedir(), '.qwen');
}
