#!/usr/bin/env node
/**
 * OMQ CLI: omq-install
 *
 * Installs or updates Oh My Qwen plugins and hooks.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import * as chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(__dirname, '..');

const omqDir = join(homedir(), '.omq');
const hooksDir = join(homedir(), '.qwen', 'hooks');

console.log(chalk.default.blue('📦 Installing Oh My Qwen...\n'));

// Create directories
for (const dir of [omqDir, hooksDir]) {
  mkdirSync(dir, { recursive: true });
}

// Install version file
const versionFile = join(omqDir, '.omq-version.json');
writeFileSync(versionFile, JSON.stringify({
  version: '0.1.0',
  installedAt: new Date().toISOString(),
}, null, 2));

// Copy hooks to global location
const hooksSrc = join(extensionRoot, 'hooks', 'scripts');
if (existsSync(hooksSrc)) {
  mkdirSync(hooksDir, { recursive: true });
  const hooksFiles = readdirSync(hooksSrc);
  let copied = 0;
  for (const file of hooksFiles) {
    const dest = join(hooksDir, file);
    cpSync(join(hooksSrc, file), dest);
    copied++;
  }
  console.log(chalk.default.green(`✅ Installed ${copied} hooks to ~/.qwen/hooks/`));
}

console.log(chalk.default.green('\n✨ Oh My Qwen installed!'));
console.log(chalk.default.gray('\nNext steps:'));
console.log(chalk.default.gray('  1. Start Qwen Code'));
console.log(chalk.default.gray('  2. Type "/omq-default" to configure your project'));
console.log(chalk.default.gray('  3. Or use any OMQ magic keyword (autopilot, ultrawork, etc.)'));
