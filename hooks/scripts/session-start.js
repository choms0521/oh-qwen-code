#!/usr/bin/env node
/**
 * OMQ Hook: Session Start
 *
 * Listens on stdin for SessionStart events.
 * Initializes OMQ state and loads project memory.
 *
 * stdin: JSON with { hook_event_name, session_id, cwd, ... }
 * stdout: JSON with { hookSpecificOutput: { additionalContext: "..." } }
 * exit: 0 = success
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => {
    try { resolve(JSON.parse(data)); } catch { resolve({}); }
  });
});

const cwd = input?.cwd || process.cwd();
const sessionId = input?.session_id || 'unknown';

// Ensure OMQ state directory exists
const stateDir = join(cwd, '.omq', 'state');
mkdirSync(stateDir, { recursive: true });

// Initialize session state
const sessionState = {
  sessionId,
  startedAt: new Date().toISOString(),
  mode: 'idle',
  todos: [],
};

const sessionFile = join(stateDir, 'session.json');
if (!existsSync(sessionFile)) {
  writeFileSync(sessionFile, JSON.stringify(sessionState, null, 2));
}

// Load project memory if exists
const memoryFile = join(cwd, '.omq', 'memory.md');
let memoryContext = '';
if (existsSync(memoryFile)) {
  memoryContext = `\n\n## Project Memory\n\n${readFileSync(memoryFile, 'utf-8')}`;
}

// Load notepad if exists
const notepadFile = join(cwd, '.omq', 'notepad.md');
let notepadContext = '';
if (existsSync(notepadFile)) {
  notepadContext = `\n\n## Working Notes\n\n${readFileSync(notepadFile, 'utf-8')}`;
}

const additionalContext = `## OMQ Session Initialized

- **Session ID**: ${sessionId}
- **Working Directory**: ${cwd}
- **State Directory**: ${stateDir}
- **Mode**: idle (awaiting task)
${memoryContext}${notepadContext}

Use TodoWrite to track tasks. Mark items in_progress before working and completed when verified.`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext,
  },
}));

process.exit(0);
