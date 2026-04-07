#!/usr/bin/env node
/**
 * OMQ Hook: Session End
 *
 * Listens on stdin for SessionEnd events.
 * Cleans up OMQ state and saves session data.
 *
 * stdin: JSON with { hook_event_name, session_id, reason, ... }
 * stdout: JSON with { hookSpecificOutput: { additionalContext: "..." } }
 * exit: 0 = success
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => {
    try { resolve(JSON.parse(data)); } catch { resolve({}); }
  });
});

const sessionId = input?.session_id || 'unknown';
const reason = input?.reason || 'unknown';
const cwd = input?.cwd || process.cwd();

const stateDir = join(cwd, '.omq', 'state');
const sessionFile = join(stateDir, 'session.json');

// Update session state with end time
if (existsSync(sessionFile)) {
  try {
    const session = JSON.parse(readFileSync(sessionFile, 'utf-8'));
    session.endedAt = new Date().toISOString();
    session.endReason = reason;

    // Archive session to history
    const historyDir = join(cwd, '.omq', 'state', 'history');
    mkdirSync(historyDir, { recursive: true });
    const archiveFile = join(historyDir, `${sessionId}.json`);
    writeFileSync(archiveFile, JSON.stringify(session, null, 2));
  } catch {
    // Ignore errors during cleanup
  }
}

const context = `## Session Ended

- **Session**: ${sessionId}
- **Reason**: ${reason}
- **Time**: ${new Date().toISOString()}

Session data has been archived. State files preserved in .omq/state/history/.`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionEnd',
    additionalContext: context,
  },
}));

process.exit(0);
