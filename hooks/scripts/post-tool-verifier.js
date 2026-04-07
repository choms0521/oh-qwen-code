#!/usr/bin/env node
/**
 * OMQ Hook: Post-Tool Verifier
 *
 * Listens on stdin for PostToolUse events.
 * Verifies tool results and updates project memory.
 *
 * stdin: JSON with { hook_event_name, tool_name, tool_output, session_id, ... }
 * stdout: JSON with { hookSpecificOutput: { additionalContext: "..." } }
 * exit: 0 = success
 */

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => {
    try { resolve(JSON.parse(data)); } catch { resolve({}); }
  });
});

const toolName = input?.tool_name || '';
const toolOutput = input?.tool_output || '';
const sessionId = input?.session_id || '';

// Track recently used tools for context injection
const recentTools = [];
recentTools.push({ tool: toolName, timestamp: new Date().toISOString() });

// Keep only last 5 tools
while (recentTools.length > 5) recentTools.shift();

// Check for common failure patterns
const failurePatterns = [
  /error:/i,
  /failed/i,
  /not found/i,
  /cannot find/i,
  /permission denied/i,
];

let context = '';
if (typeof toolOutput === 'string') {
  for (const pattern of failurePatterns) {
    if (pattern.test(toolOutput) && toolOutput.length < 500) {
      context = `\n\n## Tool Result Warning\n\nThe last ${toolName} call may have failed. Review the output carefully before proceeding.`;
      break;
    }
  }
}

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: context || '',
  },
}));

process.exit(0);
