/**
 * Agent Definitions for Oh My Qwen
 *
 * Reads agent definitions from .qwen/agents/*.md files with YAML frontmatter.
 * Each agent file has:
 * ---
 * name: agent-name
 * description: Agent description
 * tools: [list of tools]
 * model: qwen-turbo|qwen-plus|qwen-max
 * ---
 * # Agent body (prompt content)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentConfig, PluginConfig } from '../shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  model: string;
}

function parseFrontmatter(content: string): AgentFrontmatter {
  if (!content.startsWith('---')) throw new Error('Missing frontmatter');
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) throw new Error('Unterminated frontmatter');
  const yaml = content.slice(3, endIdx);
  const result: Partial<AgentFrontmatter> = {};
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      // Parse array
      const items = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      (result as any)[key] = items;
    } else {
      (result as any)[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return result as AgentFrontmatter;
}

function loadAgentsFromDir(dir: string): Record<string, AgentConfig> {
  const agents: Record<string, AgentConfig> = {};

  if (!existsSync(dir)) return agents;

  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const promptContent = content.slice(content.indexOf('---', 3) + 3).trim();

      agents[frontmatter.name] = {
        name: frontmatter.name,
        description: frontmatter.description,
        prompt: promptContent,
        tools: frontmatter.tools || [],
        model: frontmatter.model,
        defaultModel: frontmatter.model,
      };
    } catch (e) {
      // Skip files with parse errors
    }
  }

  return agents;
}

const agentsDir = join(__dirname, '../../.qwen/agents');
const cachedAgents = loadAgentsFromDir(agentsDir);

function getConfiguredAgentModel(name: string, config: PluginConfig): string | undefined {
  const keyMap: Record<string, string> = {
    'explore': 'explore', 'analyst': 'analyst', 'planner': 'planner',
    'architect': 'architect', 'debugger': 'debugger', 'executor': 'executor',
    'verifier': 'verifier', 'security-reviewer': 'securityReviewer',
    'code-reviewer': 'codeReviewer', 'test-engineer': 'testEngineer',
    'designer': 'designer', 'writer': 'writer', 'qa-tester': 'qaTester',
    'scientist': 'scientist', 'tracer': 'tracer', 'git-master': 'gitMaster',
    'code-simplifier': 'codeSimplifier', 'critic': 'critic',
    'document-specialist': 'documentSpecialist',
  };
  const key = keyMap[name];
  return key ? config.agents?.[key as keyof NonNullable<PluginConfig['agents']>]?.model : undefined;
}

/**
 * Get all agent definitions as a record for use with Qwen Code Agent API
 */
export function getAgentDefinitions(options?: {
  overrides?: Partial<Record<string, Partial<AgentConfig>>>;
  config?: PluginConfig;
}): Record<string, AgentConfig> {
  const resolvedConfig = options?.config ?? { agents: {} };
  const result: Record<string, AgentConfig> = {};

  for (const [name, agentConfig] of Object.entries(cachedAgents)) {
    const override = options?.overrides?.[name];
    const configuredModel = getConfiguredAgentModel(name, resolvedConfig);
    result[name] = {
      name: agentConfig.name,
      description: override?.description ?? agentConfig.description,
      prompt: override?.prompt ?? agentConfig.prompt,
      tools: override?.tools ?? agentConfig.tools,
      model: override?.model ?? configuredModel ?? agentConfig.model,
      defaultModel: agentConfig.defaultModel,
    };
  }

  return result;
}

/**
 * Load agent prompt from .qwen/agents/*.md file
 */
export function loadAgentPrompt(name: string): string {
  const agent = cachedAgents[name];
  return agent?.prompt ?? `You are a specialized ${name} agent for Qwen Code.`;
}
