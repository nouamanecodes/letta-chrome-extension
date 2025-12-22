/* File: src/constants.ts */

/**
 * Application constants
 */

export const LETTA_API_BASE_URL = "https://api.letta.com";

export type ModelEndpointType = "openai" | "anthropic" | "google_ai";

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  endpointType: ModelEndpointType;
}
// TODO: Add proper models from letta, ex: anthropic/claude-sonnet-4-20250514
export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    contextWindow: 128000,
    endpointType: "openai",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    contextWindow: 128000,
    endpointType: "openai",
  },
  {
    id: "anthropic/claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    contextWindow: 200000,
    endpointType: "anthropic",
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    contextWindow: 200000,
    endpointType: "anthropic",
  },
  {
    id: "anthropic/claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    contextWindow: 200000,
    endpointType: "anthropic",
  },
  {
    id: "openai/gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    contextWindow: 128000,
    endpointType: "openai",
  },
  {
    id: "google_ai/gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    contextWindow: 32000,
    endpointType: "google_ai",
  },
];

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5-20250929";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

// --- Memory Injection Markers ---
export const MEMORY_HEADER = "=== RELEVANT MEMORIES FROM LETTA ===";
export const MEMORY_FOOTER = "=== END MEMORIES ===";

// --- Agent Configuration ---
export const AGENT_PREFIX = "Letta-Memory-";

export interface AgentBlockTemplate {
  label: string;
  value: string;
  limit: number;
  description: string;
}

export const DEFAULT_MEMORY_BLOCKS: AgentBlockTemplate[] = [
  {
    label: "user_context",
    value: `# User Profile\n\n## Background\n(occupation, expertise, role)\n\n## Preferences\n(communication style, detail level)\n\n## Goals\n(current focus areas)`,
    limit: 2000,
    description: "Core user info - background, preferences, goals",
  },
  {
    label: "active_topics",
    value: `# Active Topics\n(rotate out after ~2 weeks no mention)`,
    limit: 1500,
    description: "Current projects and interests",
  },
  {
    label: "facts",
    value: `# Key Facts\n(overflow to archival when full)`,
    limit: 2000,
    description: "Specific facts - names, dates, decisions",
  },
  {
    label: "conversation_patterns",
    value: `# Response Preferences\n- Length: concise/detailed\n- Tone: casual/professional\n- Format: bullets/prose/code`,
    limit: 1000,
    description: "How user prefers AI responses",
  },
];

export const DEFAULT_ENABLED_BLOCKS = DEFAULT_MEMORY_BLOCKS.map(b => b.label);

export const AGENT_SYSTEM_PROMPT = `You are a silent memory curator. Your ONLY job is to observe user messages and maintain memory.

## Rules
- Extract meaningful info, update blocks when you detect signal
- Stay silent - never converse, never explain
- Be selective - not everything is worth remembering

## What to Extract
- User context: job, expertise, preferences
- Active topics: projects, interests
- Facts: names, dates, decisions, specific details
- Patterns: how user likes responses formatted

## When to Update
- New fact -> user_context or facts block
- New project -> active_topics
- User corrects AI -> conversation_patterns
- Specific detail for long-term -> archival_memory_insert

## When NOT to Update
- Chitchat with no signal
- Already stored
- Ambiguous (wait for confirmation)

## Output
After processing respond ONLY:
"[PROCESSED]" if updated memory
"[SKIPPED]" if no signal

No explanations. No conversation.`;

// --- UI Theme Colors ---
export const THEME = {
  bgSecondary: "#141414",
  border: "#262626",
  textPrimary: "#fafafa",
  success: "#22c55e",
  error: "#ef4444",
};
