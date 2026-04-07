/**
 * OMQ Installer
 *
 * Installs OMQ plugins, hooks, and configuration files for Qwen Code.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import * as chalk from 'chalk';

export const HOOKS_DIR = join(homedir(), '.qwen', 'hooks');
export const SKILLS_DIR = join(homedir(), '.qwen', 'skills');

export interface InstallOptions {
  force?: boolean;
  interactive?: boolean;
  configPath?: string;
}

/**
 * Check if running as a plugin (QWEN_PLUGIN_ROOT is set)
 */
export function isRunningAsPlugin(): boolean {
  return !!process.env.QWEN_PLUGIN_ROOT;
}

/**
 * Install OMQ components
 */
export async function install(options: InstallOptions = {}): Promise<void> {
  const { force = false, interactive = false } = options;

  console.log(chalk.default.green('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.default.green('║         Oh My Qwen Installation                           ║'));
  console.log(chalk.default.green('╚═══════════════════════════════════════════════════════════╝'));

  // Ensure config directories exist
  const omqDir = join(homedir(), '.omq');
  const configDir = join(omqDir, 'config');
  const stateDir = join(omqDir, 'state');

  for (const dir of [omqDir, configDir, stateDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(chalk.default.gray(`  Created ${dir}`));
    }
  }

  // Install version file
  const versionPath = join(homedir(), '.qwen', '.omq-version.json');
  if (force || !existsSync(versionPath)) {
    writeFileSync(versionPath, JSON.stringify({
      version: '0.1.0',
      installedAt: new Date().toISOString(),
    }, null, 2));
    console.log(chalk.default.green('  ✅ Version file created'));
  }

  console.log('');
  console.log(chalk.default.green('Installation complete!'));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Start Qwen Code');
  console.log('  2. Type "/omq-default" for project or "/omq-default-global" for global');
  console.log('  3. Or use "omq <task>" for one-time activation');
}
