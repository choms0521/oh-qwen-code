#!/usr/bin/env node
/**
 * OMQ Hook: Keyword Detector
 *
 * Listens on stdin for UserPromptSubmit events.
 * Detects magic keywords and injects additional context into the session.
 *
 * stdin: JSON with { hook_event_name, prompt, session_id, ... }
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

const prompt = input?.prompt || '';
const sessionData = input;

// Magic keyword → skill mapping
const SKILL_KEYWORDS = [
  { pattern: /\bautopilot\b/i, skill: 'Enable autopilot mode for full autonomous execution.' },
  { pattern: /\bultrawork|\bulw\b/i, skill: 'Enable ultrawork mode for maximum parallel execution.' },
  { pattern: /\bralph\b/i, skill: 'Enable ralph mode for persistence until verified complete.' },
  { pattern: /\bteam\s+(\d+)/i, skill: 'Enable team mode for coordinated multi-agent execution.' },
  { pattern: /\bultraqa\b/i, skill: 'Enable ultraqa mode for QA cycling until goal met.' },
  { pattern: /\bplan\s+(this|the)/i, skill: 'Enable planning mode with structured task breakdown.' },
  { pattern: /\bdeepinit\b/i, skill: 'Enable deepinit to generate hierarchical AGENTS.md documentation.' },
  { pattern: /\bdeslop|\banti-slop\b/i, skill: 'Enable ai-slop-cleaner to remove AI-generated code slop.' },
  { pattern: /\bsearch\b.*\bcodebase\b/i, skill: 'Enable explore agent for codebase search.' },
  { pattern: /\breview\b.*\bpr\b|\breview\b.*\bcode\b/i, skill: 'Enable code-reviewer agent.' },
];

const activated = [];
for (const { pattern, skill } of SKILL_KEYWORDS) {
  if (pattern.test(prompt)) {
    activated.push(skill);
  }
}

if (activated.length > 0) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `## OMQ Skills Detected\n\nThe following skills have been activated based on your prompt:\n${activated.map(s => `- ${s}`).join('\n')}`,
    },
  };
  console.log(JSON.stringify(output));
} else {
  console.log(JSON.stringify({}));
}

process.exit(0);
