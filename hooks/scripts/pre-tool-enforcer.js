#!/usr/bin/env node
/**
 * OMQ Hook: Pre-Tool Enforcer
 *
 * Listens on stdin for PreToolUse events.
 * Validates tool permissions and blocks dangerous operations.
 *
 * stdin: JSON with { hook_event_name, tool_name, tool_input, session_id, ... }
 * stdout: JSON with { decision: "allow"|"deny", hookSpecificOutput: {...} }
 * exit: 0 = allow, 2 = block
 */

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => {
    try { resolve(JSON.parse(data)); } catch { resolve({}); }
  });
});

const toolName = input?.tool_name || '';
const toolInput = input?.tool_input || {};

// Dangerous patterns to block
const dangerousPatterns = [
  { regex: /\brm\s+-rf\s+\/\b/, reason: 'Cannot delete root directory' },
  { regex: /\bmkfs\b/, reason: 'Cannot format filesystem' },
  { regex: /\bdd\s+if=\/dev\b/, reason: 'Cannot write to raw devices' },
  { regex: /\bsudo\s+rm\b/, reason: 'Cannot use sudo with rm' },
];

// Check tool input for dangerous patterns
if (toolInput?.command) {
  for (const { regex, reason } of dangerousPatterns) {
    if (regex.test(toolInput.command)) {
      console.log(JSON.stringify({
        decision: 'deny',
        reason,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }));
      process.exit(0);
    }
  }
}

// Allow by default
console.log(JSON.stringify({
  decision: 'allow',
  reason: 'Tool allowed by OMQ policy',
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    permissionDecisionReason: 'Passed OMQ security checks',
  },
}));

process.exit(0);
