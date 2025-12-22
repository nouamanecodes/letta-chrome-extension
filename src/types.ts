/**
 * Shared type definitions for the Letta Chrome Extension
 */

import type { ModelEndpointType } from "./constants";

// Capture targets (platforms)
export type CaptureTarget = "chatgpt" | "claude" | "perplexity" | "gemini";

// Injection position
export type InjectPosition = "before" | "after";

// Complete settings interface for Chrome storage
export interface Settings {
  // Connection
  apiKey: string;
  baseUrl: string;
  agentId: string;
  agentName?: string;

  // Capture settings
  captureTargets: CaptureTarget[];

  // Context injection
  autoInject: boolean;
  injectPosition: InjectPosition;
  maxContextLength: number;
  enabledBlocks: string[];

  // Advanced
  sleeptimeFrequency: number;
  debug: boolean;
}

import { DEFAULT_ENABLED_BLOCKS } from "./constants";

// Default settings - enabledBlocks should match DEFAULT_MEMORY_BLOCKS in constants.ts
export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  baseUrl: "https://api.letta.com",
  agentId: "",
  agentName: "",
  captureTargets: ["chatgpt"],
  autoInject: true,
  injectPosition: "before",
  maxContextLength: 2000,
  enabledBlocks: DEFAULT_ENABLED_BLOCKS,
  sleeptimeFrequency: 5,
  debug: false,
};

// Legacy storage interface (for backwards compatibility)
export interface StoredData {
  lettaApiKey?: string;
  agentId?: string;
  agentName?: string;
  messageInterval?: number;
  selectedBlocks?: string[];
}

// Letta API response types

export interface LLMConfig {
  model: string;
  model_endpoint_type: ModelEndpointType;
  model_endpoint: string;
  context_window: number;
  put_inner_thoughts_in_kwargs?: boolean;
  [key: string]: unknown;
}

export interface AgentState {
  id: string;
  name: string;
  created_at: string;
  llm_config: LLMConfig;
  embedding_config: LLMConfig;
  system?: string;
  tools?: string[];
  memory?: Record<string, string>;
}

export interface AgentBlock {
  id: string;
  label: string;
  value: string;
  limit: number;
  description?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  agent?: AgentState;
  message?: string;
}

// Agent template structure
export interface BlockTemplate {
  entityId: string;
  label: string;
  value: string;
  limit: number;
  description: string;
  preserveOnMigration: boolean;
  readOnly: boolean;
}

export interface AgentTemplate {
  entityId: string;
  name: string;
  model: string;
  systemPrompt: string;
  toolIds: string[];
  sourceIds: string[];
  properties: {
    max_tokens: number;
    temperature: number;
    context_window_limit: number;
    parallel_tool_calls: boolean;
  };
  toolVariables: {
    data: unknown[];
    version: string;
  };
  tags: string[];
  identityIds: string[];
  agentType: string;
  toolRules: unknown[];
  memoryVariables: {
    data: unknown[];
    version: string;
  };
}

export interface Relationship {
  agentEntityId: string;
  blockEntityId: string;
}

export interface TemplateStructure {
  agents: AgentTemplate[];
  blocks: BlockTemplate[];
  relationships: Relationship[];
  configuration: Record<string, unknown>;
  type: string;
  version: string;
}

// --- Message Sync Types ---

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LettaSyncPayload {
  userMessage: string;
  context?: ChatMessage[]; // Recent conversation history
  timestamp: number;
  url: string;
}

export interface LettaSyncMessage {
  type: "LETTA_SYNC";
  payload: LettaSyncPayload;
}

export interface LettaSyncResponse {
  success: boolean;
  error?: string;
}

// --- Memory Types ---

export interface MemoryBlock {
  id: string;
  label: string;
  value: string;
  description?: string;
  limit?: number;
}
