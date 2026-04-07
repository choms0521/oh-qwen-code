/**
 * Shared types for Oh My Qwen
 */

export type ModelType = "qwen-turbo" | "qwen-plus" | "qwen-max" | "inherit";

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  /** Tools the agent can use */
  tools?: string[];
  /** Tools explicitly disallowed for this agent */
  disallowedTools?: string[];
  model?: string;
  defaultModel?: string;
}

export interface PluginConfig {
  agents?: {
    omq?: { model?: string };
    explore?: { model?: string };
    analyst?: { model?: string };
    planner?: { model?: string };
    architect?: { model?: string };
    debugger?: { model?: string };
    executor?: { model?: string };
    verifier?: { model?: string };
    securityReviewer?: { model?: string };
    codeReviewer?: { model?: string };
    testEngineer?: { model?: string };
    designer?: { model?: string };
    writer?: { model?: string };
    qaTester?: { model?: string };
    scientist?: { model?: string };
    tracer?: { model?: string };
    gitMaster?: { model?: string };
    codeSimplifier?: { model?: string };
    critic?: { model?: string };
    documentSpecialist?: { model?: string };
  };
  features?: {
    parallelExecution?: boolean;
    lspTools?: boolean;
    astTools?: boolean;
    continuationEnforcement?: boolean;
    autoContextInjection?: boolean;
  };
  mcpServers?: Record<string, { enabled: boolean }>;
  permissions?: {
    allowBash?: boolean;
    allowEdit?: boolean;
    allowWrite?: boolean;
    maxBackgroundTasks?: number;
  };
  routing?: {
    enabled?: boolean;
    defaultTier?: string;
    forceInherit?: boolean;
    escalationEnabled?: boolean;
    maxEscalations?: number;
    tierModels?: Record<string, string>;
  };
  notifications?: {
    enabled?: boolean;
  };
}

export interface ExternalModelsConfig {
  codexModel?: string;
  geminiModel?: string;
}
