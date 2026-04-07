#!/usr/bin/env node
/**
 * OMQ CLI: omq-default
 *
 * Configures OMQ for the current project.
 * Creates .qwen/settings.json and agent files if they don't exist.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(__dirname, '..');

const projectDir = process.cwd();
const qwenDir = join(projectDir, '.qwen');

console.log(chalk.default.blue('⚙️  Configuring Oh My Qwen for current project...\n'));

// Create .qwen directory
mkdirSync(qwenDir, { recursive: true });

// Copy agent files if not exists
const agentsSrc = join(extensionRoot, '.qwen', 'agents');
const agentsDest = join(qwenDir, 'agents');

if (existsSync(agentsSrc)) {
  mkdirSync(agentsDest, { recursive: true });
  const agentFiles = readdirSync(agentsSrc);
  let copied = 0;
  for (const file of agentFiles) {
    const dest = join(agentsDest, file);
    if (!existsSync(dest)) {
      cpSync(join(agentsSrc, file), dest);
      copied++;
    }
  }
  console.log(chalk.default.green(`✅ Copied ${copied} agent definitions to .qwen/agents/`));
}

// Create .qwen/settings.json if not exists
const settingsFile = join(qwenDir, 'settings.json');
if (!existsSync(settingsFile)) {
  const templateSettings = {
    disableAllHooks: false,
    hooks: {
      UserPromptSubmit: [{
        matcher: '.*',
        sequential: false,
        hooks: [{
          type: 'command',
          command: `node ${join(extensionRoot, 'dist', 'hooks', 'keyword-detector.js')}`,
          name: 'omq-keyword-detector',
          description: 'Detect magic keywords for skill activation',
          timeout: 5000,
        }],
      }],
    },
  };
  writeFileSync(settingsFile, JSON.stringify(templateSettings, null, 2));
  console.log(chalk.default.green('✅ Created .qwen/settings.json'));
}

console.log(chalk.default.green('\n✨ OMQ configured for this project!'));
console.log(chalk.default.gray('\nAvailable agents: 19 (qwen-turbo/plus/max)'));
console.log(chalk.default.gray('Hooks: 7 lifecycle events'));
console.log(chalk.default.gray('MCP Tools: omq_notify, omq_plan, omq_agents, omq_python, omq_state'));
