# Oh My Qwen (OMQ)

> Multi-agent orchestration framework for Qwen Code

## Overview

Oh My Qwen is a comprehensive multi-agent orchestration framework designed for Qwen Code. It provides 19 specialized agents, 37 skills, lifecycle hooks, HUD, and team orchestration to automate complex software engineering tasks.

## Features

- **19 Specialized Agents** - Each mapped to optimal Qwen model tier
  - **qwen-turbo** (LOW): explore, writer, tracer
  - **qwen-plus** (MEDIUM): debugger, executor, verifier, security-reviewer, test-engineer, designer, qa-tester, scientist, git-master, document-specialist
  - **qwen-max** (HIGH): analyst, planner, architect, code-reviewer, code-simplifier, critic

- **37 Skills** - Markdown-based workflow templates
- **Lifecycle Hooks** - PromptSubmit, SessionStart, PreToolUse, PostToolUse, SessionEnd
- **MCP Tools** - Model Context Protocol server support
- **Python REPL** - Secure Python execution environment
- **Notifications** - Telegram, Discord, Slack, custom webhooks
- **Auto-Update** - GitHub release-based updates

## Installation

```bash
npm install -g oh-my-qwen
omq install
```

## Usage

### CLI

```bash
# Start orchestration
omq <task description>

# Install/update
omq install --force

# Check health
omq doctor

# Setup wizard
omq setup
```

### Configuration

Environment variables:
```bash
export OMQ_MODEL_HIGH="qwen-max"
export OMQ_MODEL_MEDIUM="qwen-plus"
export OMQ_MODEL_LOW="qwen-turbo"
```

Config file (`~/.qwen/qwen-omq/config.jsonc`):
```jsonc
{
  "agents": {
    "executor": { "model": "qwen-plus" },
    "architect": { "model": "qwen-max" }
  },
  "routing": {
    "forceInherit": false,
    "escalationEnabled": true
  }
}
```

## Architecture

```
src/
├── agents/          # 19 specialized agent definitions
├── cli/             # CLI commands (omq)
├── config/          # Configuration loader + model routing
├── features/        # Core features (auto-update, delegation)
├── hooks/           # Lifecycle hooks
├── installer/       # Installation logic
├── mcp/             # MCP server
├── notifications/   # Notification system
├── planning/        # Plan generation and management
├── tools/           # Custom tools (Python REPL, LSP, AST)
├── shared/          # Shared types
└── utils/           # Utilities
```

## Development

```bash
npm install
npm run build          # TypeScript build
npm run build:check    # Type check only
npm run lint           # ESLint
npm run test           # Run tests
```

## License

MIT
