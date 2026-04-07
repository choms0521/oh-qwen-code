#!/usr/bin/env node
/**
 * OMQ Hook: Subagent Start
 *
 * Listens on stdin for SubagentStart events.
 * Tracks subagent execution for monitoring.
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

const context = `## Subagent Started

- **Agent**: ${agentId}
- **Type**: ${agentType}
- **Started**: ${new Date().toISOString()}

Monitor this agent's progress and verify its deliverables upon completion.`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SubagentStart',
    additionalContext: context,
  },
}));

process.exit(0);
