/**
 * Letta API Service
 * 
 * Wrapper around the Letta SDK for Chrome extension use.
 * Handles memory blocks, passages, message capture, and agent management.
 */

import Letta from "@letta-ai/letta-client";
import { 
  LETTA_API_BASE_URL, 
  DEFAULT_MEMORY_BLOCKS, 
  AGENT_SYSTEM_PROMPT,
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  type AgentBlockTemplate
} from "../constants";
import type { AgentState } from "../types";

// Derive types from SDK
type Block = Awaited<ReturnType<Letta["agents"]["blocks"]["list"]>>["items"][number];
type PassageSearchResult = Awaited<ReturnType<Letta["agents"]["passages"]["search"]>>["results"][number];
type Agent = Awaited<ReturnType<Letta["agents"]["retrieve"]>>;

// --- Public Types ---

export interface MemoryBlock {
  id: string;
  label: string;
  value: string;
  description?: string;
  limit?: number;
}

export interface PassageResult {
  content: string;
  timestamp: string;
  tags?: string[];
}

export interface SearchResults {
  blocks: MemoryBlock[];
  passages: PassageResult[];
}

export interface SendMessageResult {
  success: boolean;
  response: string;
  rawResponse: unknown;
}

// --- No-op logging functions ---
export function setApiDebug(_enabled: boolean): void {}

// --- Service Class ---

export class LettaAPIService {
  private client: Letta;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Letta({
      apiKey: apiKey,
      baseURL: LETTA_API_BASE_URL,
    });
  }

  /**
   * Validate API connection by listing agents
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.client.agents.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get agent details
   */
  async getAgent(agentId: string): Promise<AgentState> {
    const agent = await this.client.agents.retrieve(agentId);
    return this.mapAgentToState(agent);
  }

  /**
   * Fetch all core memory blocks for an agent
   */
  async getMemoryBlocks(agentId: string): Promise<MemoryBlock[]> {
    try {
      const blocksPage = await this.client.agents.blocks.list(agentId);
      const blocks = blocksPage.items;

      // Filter out system blocks and map to our interface
      return blocks
        .filter((b: Block) => !["system", "functions", "function_schemas"].includes(b.label || ""))
        .map((b: Block): MemoryBlock => ({
          id: b.id || "",
          label: b.label || "",
          value: b.value || "",
          description: b.description || undefined,
          limit: b.limit,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Semantic search on archival memory (passages)
   */
  async searchPassages(agentId: string, query: string, topK: number = 10): Promise<PassageResult[]> {
    try {
      const response = await this.client.agents.passages.search(agentId, {
        query: query,
        top_k: topK,
      });

      return response.results.map((r: PassageSearchResult): PassageResult => ({
        content: r.content,
        timestamp: r.timestamp,
        tags: r.tags,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get all memories (blocks + optional passage search)
   */
  async getAllMemories(agentId: string, searchQuery?: string): Promise<SearchResults> {
    try {
      const blocks = await this.getMemoryBlocks(agentId);

      let passages: PassageResult[] = [];
      if (searchQuery && searchQuery.trim().length >= 3) {
        passages = await this.searchPassages(agentId, searchQuery);
      }

      return { blocks, passages };
    } catch {
      return { blocks: [], passages: [] };
    }
  }

  /**
   * Send a message to the Letta agent (invokes agent LLM)
   * @deprecated Use captureMessages() instead for syncing - it's cheaper and faster
   */
  async sendMessage(agentId: string, message: string): Promise<SendMessageResult> {
    try {
      const response = await this.client.agents.messages.create(agentId, {
        messages: [{ role: "user", content: message }],
      });

      // Extract assistant response
      let assistantResponse = "";
      for (const msg of response.messages) {
        if (msg.message_type === "assistant_message" && "content" in msg) {
          assistantResponse = String(msg.content) || "";
          break;
        }
      }

      // Only return success if we got a meaningful response
      const trimmedResponse = assistantResponse.trim();
      if (!trimmedResponse) {
        return {
          success: false,
          response: "",
          rawResponse: response,
        };
      }

      return {
        success: true,
        response: trimmedResponse,
        rawResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        response: "",
        rawResponse: { error: (error as Error).message },
      };
    }
  }

  /**
   * Capture messages WITHOUT invoking agent LLM
   * Stores messages for sleeptime agent to process later.
   * Much cheaper and faster than sendMessage().
   * 
   * @param agentId - The agent ID
   * @param messages - Array of messages to capture
   * @param platform - The platform (chatgpt, claude, gemini, perplexity)
   */
  async captureMessages(
    agentId: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    platform: string = "chatgpt"
  ): Promise<{ success: boolean }> {
    const captureUrl = `${LETTA_API_BASE_URL}/v1/agents/${agentId}/messages/capture`;

    // Map platform to provider
    const providerMap: Record<string, string> = {
      chatgpt: "openai",
      claude: "anthropic",
      gemini: "google",
      perplexity: "perplexity",
    };
    const provider = providerMap[platform] || "openai";

    const payload = {
      provider: provider,
      model: platform,
      request_messages: messages.map(m => ({ role: m.role, content: m.content })),
      response_dict: { role: "assistant", content: "(pending)" },
    };

    const response = await fetch(captureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Capture failed: ${response.status} - ${errorText}`);
    }

    return { success: true };
  }

  /**
   * Create a new agent with memory blocks
   */
  async createAgent(config: {
    name: string;
    model?: string;
    embedding?: string;
    memoryBlocks?: AgentBlockTemplate[];
    systemPrompt?: string;
  }): Promise<AgentState> {
    const model = config.model || DEFAULT_MODEL;
    const embedding = config.embedding || DEFAULT_EMBEDDING_MODEL;
    const memoryBlocks = config.memoryBlocks || DEFAULT_MEMORY_BLOCKS;
    const systemPrompt = config.systemPrompt || AGENT_SYSTEM_PROMPT;

    // Create blocks first and collect their IDs
    const blockIds: string[] = [];
    for (const blockDef of memoryBlocks) {
      const createdBlock = await this.client.blocks.create({
        label: blockDef.label,
        value: blockDef.value,
        limit: blockDef.limit,
        description: blockDef.description,
      });
      if (createdBlock.id) {
        blockIds.push(createdBlock.id);
      }
    }

    // Define tools and create agent
    const agentConfig = {
      agent_type: "letta_v1_agent" as const,
      name: config.name,
      model: model,
      embedding: embedding,
      context_window_limit: 128000,
      tools: ["memory", "archival_memory_insert", "archival_memory_search"],
      block_ids: blockIds,
      system: systemPrompt,
      tags: ["origin:letta-chrome-extension"],
      include_base_tools: false,
      include_base_tool_rules: false,
      initial_message_sequence: [],
      enable_sleeptime: true,
      sleeptime_agent_frequency: 5,
    };

    const agent = await this.client.agents.create(agentConfig);
    return this.mapAgentToState(agent);
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<AgentState[]> {
    const response = await this.client.agents.list();
    return (response.items || []).map(agent => this.mapAgentToState(agent));
  }

  /**
   * Update agent's model configuration
   * 
   * @param agentId - The agent ID
   * @param model - The model name to update to
   */
  async updateAgentModel(agentId: string, model: string): Promise<AgentState> {
    const agent = await this.client.agents.update(agentId, {
      model: model,
    });
    return this.mapAgentToState(agent);
  }

  /**
   * Map SDK agent to our AgentState type
   */
  private mapAgentToState(agent: Agent): AgentState {
    return {
      id: agent.id,
      name: agent.name,
      created_at: agent.created_at || "",
      llm_config: agent.llm_config as unknown as AgentState["llm_config"],
      embedding_config: agent.embedding_config as unknown as AgentState["embedding_config"],
      system: agent.system || undefined,
      tools: (agent.tools?.map(t => t.name).filter((name): name is string => !!name)) || [],
    };
  }
}

// --- Singleton Helper ---

let _instance: LettaAPIService | null = null;
let _instanceApiKey: string | null = null;

export function getLettaService(apiKey: string): LettaAPIService {
  if (!_instance || _instanceApiKey !== apiKey) {
    _instance = new LettaAPIService(apiKey);
    _instanceApiKey = apiKey;
  }
  return _instance;
}
