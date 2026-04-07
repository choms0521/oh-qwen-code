---
name: omq-reference
description: OMC agent catalog, available tools, team pipeline routing, commit protocol, and skills registry. Auto-loads when delegating to agents, using OMC tools, orchestrating teams, making commits, or invoking skills.
user-invocable: false
---

# OMC Reference

Use this built-in reference when you need detailed OMC catalog information that does not need to live in every `CLAUDE.md` session.

## Agent Catalog

Prefix: `oh-my-qwen:`. See `agents/*.md` for full prompts.

- `explore` (qwen-turbo) — fast codebase search and mapping
- `analyst` (qwen-max) — requirements clarity and hidden constraints
- `planner` (qwen-max) — sequencing and execution plans
- `architect` (qwen-max) — system design, boundaries, and long-horizon tradeoffs
- `debugger` (qwen-plus) — root-cause analysis and failure diagnosis
- `executor` (qwen-plus) — implementation and refactoring
- `verifier` (qwen-plus) — completion evidence and validation
- `tracer` (qwen-plus) — trace gathering and evidence capture
- `security-reviewer` (qwen-plus) — trust boundaries and vulnerabilities
- `code-reviewer` (qwen-max) — comprehensive code review
- `test-engineer` (qwen-plus) — testing strategy and regression coverage
- `designer` (qwen-plus) — UX and interaction design
- `writer` (qwen-turbo) — documentation and concise content work
- `qa-tester` (qwen-plus) — runtime/manual validation
- `scientist` (qwen-plus) — data analysis and statistical reasoning
- `document-specialist` (qwen-plus) — SDK/API/framework documentation lookup
- `git-master` (qwen-plus) — commit strategy and history hygiene
- `code-simplifier` (qwen-max) — behavior-preserving simplification
- `critic` (qwen-max) — plan/design challenge and review

## Model Routing

- `qwen-turbo` — quick lookups, lightweight inspection, narrow docs work
- `qwen-plus` — standard implementation, debugging, and review
- `qwen-max` — architecture, deep analysis, consensus planning, and high-risk review

## Tools Reference

### External AI / orchestration
- `/team N:executor "task"`
- `omq team N:codex|gemini "..."`
- `omq ask <claude|codex|gemini>`
- `/ccg`

### OMQ state
- `state_read`, `state_write`, `state_clear`, `state_list_active`, `state_get_status`

### Team runtime
- `TeamCreate`, `TeamDelete`, `SendMessage`, `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`

### Notepad
- `notepad_read`, `notepad_write_priority`, `notepad_write_working`, `notepad_write_manual`

### Project memory
- `project_memory_read`, `project_memory_write`, `project_memory_add_note`, `project_memory_add_directive`

### Code intelligence
- LSP: `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics`, and related helpers
- AST: `ast_grep_search`, `ast_grep_replace`
- Utility: `python_repl`

## Skills Registry

Invoke built-in workflows via `/oh-my-qwen:<name>`.

### Workflow skills
- `autopilot` — full autonomous execution from idea to working code
- `ralph` — persistence loop until completion with verification
- `ultrawork` — high-throughput parallel execution
- `visual-verdict` — structured visual QA verdicts
- `team` — coordinated team orchestration
- `ccg` — Codex + Gemini + Claude synthesis lane
- `ultraqa` — QA cycle: test, verify, fix, repeat
- `omq-plan` — planning workflow and `/plan`-safe alias
- `ralplan` — consensus planning workflow
- `sciomc` — science/research workflow
- `external-context` — external docs/research workflow
- `deepinit` — hierarchical AGENTS.md generation
- `deep-interview` — Socratic ambiguity-gated requirements workflow
- `ai-slop-cleaner` — regression-safe cleanup workflow

### Utility skills
- `ask`, `cancel`, `note`, `learner`, `omq-setup`, `mcp-setup`, `hud`, `omq-doctor`, `trace`, `release`, `project-session-manager`, `skill`, `writer-memory`, `configure-notifications`

### Keyword triggers kept compact in CLAUDE.md
- `"autopilot"→autopilot`
- `"ralph"→ralph`
- `"ulw"→ultrawork`
- `"ccg"→ccg`
- `"ralplan"→ralplan`
- `"deep interview"→deep-interview`
- `"deslop" / "anti-slop"→ai-slop-cleaner`
- `"deep-analyze"→analysis mode`
- `"tdd"→TDD mode`
- `"deepsearch"→codebase search`
- `"ultrathink"→deep reasoning`
- `"cancelomc"→cancel`
- Team orchestration is explicit via `/team`.

## Team Pipeline

Stages: `team-plan` → `team-prd` → `team-exec` → `team-verify` → `team-fix` (loop).

- Use `team-fix` for bounded remediation loops.
- `team ralph` links the team pipeline with Ralph-style sequential verification.
- Prefer team mode when independent parallel lanes justify the coordination overhead.

## Commit Protocol

Use git trailers to preserve decision context in every commit message.

### Format
- Intent line first: why the change was made
- Optional body with context and rationale
- Structured trailers when applicable

### Common trailers
- `Constraint:` active constraint shaping the decision
- `Rejected:` alternative considered | reason for rejection
- `Directive:` forward-looking warning or instruction
- `Confidence:` `high` | `medium` | `low`
- `Scope-risk:` `narrow` | `moderate` | `broad`
- `Not-tested:` known verification gap

### Example
```text
feat(docs): reduce always-loaded OMC instruction footprint

Move reference-only orchestration content into a native Claude skill so
session-start guidance stays small while detailed OMC reference remains available.

Constraint: Preserve CLAUDE.md marker-based installation flow
Rejected: Sync all built-in skills in legacy install | broader behavior change than issue requires
Confidence: high
Scope-risk: narrow
Not-tested: End-to-end plugin marketplace install in a fresh Claude profile
```
