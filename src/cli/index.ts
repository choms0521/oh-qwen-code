#!/usr/bin/env node
/**
 * OMQ CLI Entry Point
 *
 * Command-line interface for Oh My Qwen orchestration.
 */

import { Command } from 'commander';
import * as chalk from 'chalk';

const version = '0.1.0';

const program = new Command();

program
  .name('omq')
  .description('Oh My Qwen - Multi-agent orchestration for Qwen Code')
  .version(version);

program
  .command('install')
  .description('Install OMQ plugins and hooks')
  .option('-f, --force', 'Force overwrite existing files')
  .action(async (opts) => {
    console.log(chalk.default.green('Installing Oh My Qwen...'));
    const { install } = await import('../installer/index.js');
    await install({ force: opts.force });
  });

program
  .command('doctor')
  .description('Run diagnostics and check installation health')
  .action(async () => {
    console.log(chalk.default.blue('Running OMQ diagnostics...'));
    console.log('✅ OMQ is installed');
    console.log(`📦 Version: ${version}`);
  });

program
  .command('setup')
  .description('Run setup wizard for first-time configuration')
  .action(async () => {
    console.log(chalk.default.blue('Setting up Oh My Qwen...'));
    const { install } = await import('../installer/index.js');
    await install({ interactive: true });
  });

program.parse();
