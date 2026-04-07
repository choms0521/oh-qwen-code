#!/usr/bin/env node
/**
 * OMQ Hook: Subagent Stop
 *
 * Listens on stdin for SubagentStop events.
 * Verifies subagent deliverables on completion.
 *
 * stdin: JSON with { hook_event_name, agent_id, agent_type, session_id, ... }
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

const agentId = input?.agent_id || 'unknown';
const agentType = input?.agent_type || 'unknown';

const context = `## Subagent Stopped

- **Agent**: ${agentId}
- **Type**: ${agentType}
- **Stopped**: ${new Date().toISOString()}

Verify the deliverables produced by this agent before proceeding.
Check that:
1. All requested tasks are completed
2. Tests pass (if applicable)
3. No errors remain unaddressed`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SubagentStop',
    additionalContext: context,
  },
}));

process.exit(0);
