/**
 * LSP Server Configurations
 *
 * Defines known language servers and their configurations.
 * Supports auto-detection and installation hints.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { extname, isAbsolute } from 'path';

export interface LspServerConfig {
  name: string;
  command: string;
  args: string[];
  extensions: string[];
  installHint: string;
  initializationOptions?: Record<string, unknown>;
  initializeTimeoutMs?: number;
}

/**
 * Known LSP servers and their configurations
 */
export const LSP_SERVERS: Record<string, LspServerConfig> = {
  typescript: {
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'],
    installHint: 'npm install -g typescript-language-server typescript',
  },
  python: {
    name: 'Python Language Server (pylsp)',
    command: 'pylsp',
    args: [],
    extensions: ['.py', '.pyw'],
    installHint: 'pip install python-lsp-server',
  },
  rust: {
    name: 'Rust Analyzer',
    command: 'rust-analyzer',
    args: [],
    extensions: ['.rs'],
    installHint: 'rustup component add rust-analyzer',
  },
  go: {
    name: 'gopls',
    command: 'gopls',
    args: ['serve'],
    extensions: ['.go'],
    installHint: 'go install golang.org/x/tools/gopls@latest',
  },
  c: {
    name: 'clangd',
    command: 'clangd',
    args: [],
    extensions: ['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx'],
    installHint: 'Install clangd from your package manager or LLVM',
  },
  java: {
    name: 'Eclipse JDT Language Server',
    command: 'jdtls',
    args: [],
    extensions: ['.java'],
    installHint: 'Install from https://github.com/eclipse/eclipse.jdt.ls',
  },
  json: {
    name: 'JSON Language Server',
    command: 'vscode-json-language-server',
    args: ['--stdio'],
    extensions: ['.json', '.jsonc'],
    installHint: 'npm install -g vscode-langservers-extracted',
  },
  html: {
    name: 'HTML Language Server',
    command: 'vscode-html-language-server',
    args: ['--stdio'],
    extensions: ['.html', '.htm'],
    installHint: 'npm install -g vscode-langservers-extracted',
  },
  css: {
    name: 'CSS Language Server',
    command: 'vscode-css-language-server',
    args: ['--stdio'],
    extensions: ['.css', '.scss', '.less'],
    installHint: 'npm install -g vscode-langservers-extracted',
  },
  yaml: {
    name: 'YAML Language Server',
    command: 'yaml-language-server',
    args: ['--stdio'],
    extensions: ['.yaml', '.yml'],
    installHint: 'npm install -g yaml-language-server',
  },
};

export interface ExtendedLspServerConfig extends LspServerConfig {
  installed: boolean;
}

/**
 * Check if a command exists on the system
 */
export function commandExists(cmd: string): boolean {
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookupCmd, [cmd], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Get server configuration for a file path
 */
export function getServerForFile(filePath: string): ExtendedLspServerConfig | undefined {
  const ext = extname(filePath).toLowerCase();
  for (const [key, config] of Object.entries(LSP_SERVERS)) {
    if (config.extensions.includes(ext)) {
      return {
        ...config,
        installed: commandExists(config.command),
      };
    }
  }
  return undefined;
}

/**
 * Get server configuration for a language
 */
export function getServerForLanguage(language: string): ExtendedLspServerConfig | undefined {
  for (const [key, config] of Object.entries(LSP_SERVERS)) {
    if (key === language.toLowerCase()) {
      return {
        ...config,
        installed: commandExists(config.command),
      };
    }
  }
  return undefined;
}

/**
 * Get all server configurations with installation status
 */
export function getAllServers(): ExtendedLspServerConfig[] {
  return Object.values(LSP_SERVERS).map(config => ({
    ...config,
    installed: commandExists(config.command),
  }));
}
