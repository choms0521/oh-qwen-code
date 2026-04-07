/**
 * Utility functions for paths and file system operations.
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Get the OMQ state root directory.
 * ~/.omq/
 */
export function getOmqRoot(): string {
  return join(homedir(), '.omq');
}

/**
 * Get the global OMQ config root.
 */
export function getGlobalOmqConfigRoot(): string {
  return join(getOmqRoot(), 'config');
}

/**
 * Get the global OMQ state root.
 */
export function getGlobalOmqStateRoot(): string {
  return join(getOmqRoot(), 'state');
}

/**
 * Ensure a directory exists, create it if it doesn't.
 */
export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}
