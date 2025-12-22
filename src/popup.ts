/* File: src/popup.ts - Letta Settings Page */

import type { Settings, CaptureTarget } from "./types";
import { LettaAPIService } from "./services/letta-api";
import { getSettings, saveSettings } from "./utils/storage";
import { 
  AGENT_PREFIX, 
  DEFAULT_MEMORY_BLOCKS, 
  AGENT_SYSTEM_PROMPT,
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
} from "./constants";

// DOM Elements
let apiKeyInput: HTMLInputElement;
let agentSelect: HTMLSelectElement;
let refreshAgentsBtn: HTMLButtonElement;
let testBtn: HTMLButtonElement;
let createAgentBtn: HTMLButtonElement;
let agentCountSpan: HTMLElement;
let platformCheckboxes: NodeListOf<HTMLInputElement>;
let blocksContainer: HTMLElement;
let refreshBlocksBtn: HTMLButtonElement;

let saveBtn: HTMLButtonElement;
let statusDot: HTMLElement;
let statusText: HTMLElement;
let toast: HTMLElement;

document.addEventListener("DOMContentLoaded", async () => {
  // Check if onboarding is needed
  const { onboardingComplete } = await chrome.storage.local.get("onboardingComplete");
  const settings = await getSettings();
  
  if (!onboardingComplete && (!settings.apiKey || !settings.agentId)) {
    // Redirect to onboarding
    window.location.href = "onboarding.html";
    return;
  }
  
  initElements();
  await loadSettings();
  attachListeners();
});

function initElements() {
  apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
  agentSelect = document.getElementById("agentSelect") as HTMLSelectElement;
  refreshAgentsBtn = document.getElementById("refreshAgentsBtn") as HTMLButtonElement;
  testBtn = document.getElementById("testBtn") as HTMLButtonElement;
  createAgentBtn = document.getElementById("createAgentBtn") as HTMLButtonElement;
  agentCountSpan = document.getElementById("agentCount") as HTMLElement;
  platformCheckboxes = document.querySelectorAll('input[data-platform]');
  blocksContainer = document.getElementById("blocksContainer") as HTMLElement;
  refreshBlocksBtn = document.getElementById("refreshBlocksBtn") as HTMLButtonElement;
  saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
  statusDot = document.getElementById("statusDot") as HTMLElement;
  statusText = document.getElementById("statusText") as HTMLElement;
  toast = document.getElementById("toast") as HTMLElement;
}

async function loadSettings() {
  const settings = await getSettings();
  
  // Connection
  apiKeyInput.value = settings.apiKey || "";
  
  // Load agents if API key exists
  if (settings.apiKey) {
    await loadAgents(settings.apiKey, settings.agentId);
    
    // Load blocks if agent is selected
    if (settings.agentId) {
      await loadMemoryBlocks(settings.apiKey, settings.agentId, settings.enabledBlocks);
    }
  }
  
  // Platform checkboxes
  platformCheckboxes.forEach((checkbox) => {
    const platform = checkbox.dataset.platform;
    checkbox.checked = platform ? settings.captureTargets.includes(platform as CaptureTarget) : false;
  });
  
  // Update status
  await updateConnectionStatus(settings);
}

// Load memory blocks from agent
// Returns true on success, false on failure
async function loadMemoryBlocks(apiKey: string, agentId: string, enabledBlocks: string[] = []): Promise<boolean> {
  blocksContainer.innerHTML = '<span class="blocks-placeholder">Loading blocks...</span>';
  
  try {
    const api = new LettaAPIService(apiKey);
    const blocks = await api.getMemoryBlocks(agentId);
    
    if (blocks.length === 0) {
      blocksContainer.innerHTML = '<span class="blocks-placeholder">No memory blocks found</span>';
      return true; // Success - just no blocks
    }
    
    // Build block cards with full content
    blocksContainer.innerHTML = "";
    blocks.forEach(block => {
      const isEnabled = enabledBlocks.length === 0 || enabledBlocks.includes(block.label);
      // Show up to 500 chars of content
      const contentPreview = block.value 
        ? (block.value.length > 500 ? block.value.substring(0, 500) + "..." : block.value)
        : "(empty)";
      
      const card = document.createElement("div");
      card.className = "block-card";
      
      card.innerHTML = `
        <div class="block-header">
          <label class="checkbox-label">
            <input type="checkbox" data-block="${escapeHtml(block.label)}" ${isEnabled ? "checked" : ""} />
            <span class="checkmark"></span>
            <span class="block-label">${escapeHtml(block.label)}</span>
          </label>
        </div>
        <div class="block-content">${escapeHtml(contentPreview)}</div>
      `;
      
      blocksContainer.appendChild(card);
    });
    
    return true;
  } catch {
    blocksContainer.innerHTML = '<span class="blocks-placeholder">Failed to load blocks</span>';
    return false;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Load agents from API and populate dropdown
// Returns true on success, false on failure
async function loadAgents(apiKey: string, selectedAgentId?: string): Promise<boolean> {
  agentSelect.disabled = true;
  agentSelect.innerHTML = '<option value="">Loading...</option>';
  
  try {
    const api = new LettaAPIService(apiKey);
    const agents = await api.listAgents();
    
    // Filter to only show Letta-Memory-* agents
    const filteredAgents = agents.filter(agent => 
      agent.name && agent.name.startsWith(AGENT_PREFIX)
    );
    
    // Clear and populate dropdown
    agentSelect.innerHTML = '<option value="">Select an agent...</option>';
    
    filteredAgents.forEach(agent => {
      const option = document.createElement("option");
      option.value = agent.id;
      option.textContent = agent.name || agent.id;
      if (agent.id === selectedAgentId) {
        option.selected = true;
      }
      agentSelect.appendChild(option);
    });
    
    // Update count
    agentCountSpan.textContent = `${filteredAgents.length} agent${filteredAgents.length !== 1 ? 's' : ''}`;
    
    if (filteredAgents.length === 0) {
      agentSelect.innerHTML = '<option value="">No agents found - create one</option>';
    }
    
    agentSelect.disabled = false;
    return true;
  } catch {
    agentSelect.innerHTML = '<option value="">Failed to load agents</option>';
    agentCountSpan.textContent = "Error";
    agentSelect.disabled = false;
    return false;
  }
}

async function updateConnectionStatus(settings: Settings) {
  if (!settings.apiKey || !settings.agentId) {
    setStatus("disconnected", "Not connected");
    return;
  }
  
  try {
    const api = new LettaAPIService(settings.apiKey);
    const agent = await api.getAgent(settings.agentId);
    if (agent) {
      setStatus("connected", agent.name || "Connected");
    } else {
      setStatus("error", "Invalid agent");
    }
  } catch {
    setStatus("error", "Connection error");
  }
}

function setStatus(state: "connected" | "disconnected" | "error" | "loading", text: string) {
  statusDot.className = "status-dot";
  if (state === "connected") statusDot.classList.add("connected");
  if (state === "error") statusDot.classList.add("error");
  if (state === "loading") statusDot.classList.add("loading");
  statusText.textContent = text;
}

// Button loading state helpers
function setButtonLoading(btn: HTMLButtonElement, loading: boolean, originalText?: string) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>`;
    btn.classList.add("loading");
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText || btn.dataset.originalText || "";
    btn.classList.remove("loading");
  }
}

function attachListeners() {
  // Test connection
  testBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key first", "error");
      return;
    }
    
    setButtonLoading(testBtn, true);
    setStatus("loading", "Testing...");
    
    try {
      const api = new LettaAPIService(apiKey);
      const valid = await api.validateConnection();
      if (valid) {
        showToast("Connection successful!", "success");
        setStatus("connected", "API key valid");
      } else {
        showToast("Invalid API key", "error");
        setStatus("error", "Invalid key");
      }
    } catch {
      showToast("Connection failed", "error");
      setStatus("error", "Connection failed");
    }
    setButtonLoading(testBtn, false);
  });
  
  // Refresh agents list
  refreshAgentsBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key first", "error");
      return;
    }
    
    setButtonLoading(refreshAgentsBtn, true);
    try {
      const success = await loadAgents(apiKey, agentSelect.value);
      if (success) {
        showToast("Agents refreshed", "success");
      } else {
        showToast("Failed to load agents", "error");
      }
    } finally {
      setButtonLoading(refreshAgentsBtn, false);
    }
  });
  
  // Agent selection changed - load blocks
  agentSelect.addEventListener("change", async () => {
    const agentId = agentSelect.value;
    const apiKey = apiKeyInput.value.trim();
    
    if (agentId && apiKey) {
      const settings = await getSettings();
      await updateConnectionStatus({ ...settings, agentId });
      await loadMemoryBlocks(apiKey, agentId, settings.enabledBlocks);
    } else {
      blocksContainer.innerHTML = '<span class="blocks-placeholder">Select an agent to load blocks</span>';
    }
  });
  
  // Refresh blocks button
  refreshBlocksBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const agentId = agentSelect.value;
    
    if (!apiKey || !agentId) {
      showToast("Select an agent first", "error");
      return;
    }
    
    const settings = await getSettings();
    const success = await loadMemoryBlocks(apiKey, agentId, settings.enabledBlocks);
    if (success) {
      showToast("Blocks refreshed", "success");
    } else {
      showToast("Failed to load blocks", "error");
    }
  });
  
  // Create agent
  createAgentBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key first", "error");
      return;
    }
    
    setButtonLoading(createAgentBtn, true);
    setStatus("loading", "Creating agent...");
    
    try {
      const api = new LettaAPIService(apiKey);
      
      const agent = await api.createAgent({
        name: `${AGENT_PREFIX}${Date.now()}`,
        model: DEFAULT_MODEL,
        embedding: DEFAULT_EMBEDDING_MODEL,
        memoryBlocks: DEFAULT_MEMORY_BLOCKS,
        systemPrompt: AGENT_SYSTEM_PROMPT,
      });
      
      if (agent.id) {
        // Refresh the agents list and select the new one
        await loadAgents(apiKey, agent.id);
        showToast("Agent created!", "success");
        setStatus("connected", agent.name);
      }
    } catch {
      showToast("Failed to create agent", "error");
      setStatus("error", "Creation failed");
    }
    setButtonLoading(createAgentBtn, false);
  });
  
  
  // Save settings
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    
    try {
      // Collect enabled platforms
      const captureTargets: CaptureTarget[] = [];
      platformCheckboxes.forEach((checkbox) => {
        if (checkbox.checked && checkbox.dataset.platform) {
          captureTargets.push(checkbox.dataset.platform as CaptureTarget);
        }
      });
      
      // Enabled memory blocks (from dynamic checkboxes)
      const enabledBlocks: string[] = [];
      const blockCheckboxes = blocksContainer.querySelectorAll('input[data-block]');
      blockCheckboxes.forEach((checkbox) => {
        const input = checkbox as HTMLInputElement;
        if (input.checked && input.dataset.block) {
          enabledBlocks.push(input.dataset.block);
        }
      });
      
      const settings: Partial<Settings> = {
        apiKey: apiKeyInput.value.trim(),
        agentId: agentSelect.value,
        captureTargets,
        enabledBlocks,
      };
      
      const saved = await saveSettings(settings);
      await updateConnectionStatus(saved);
      
      showToast("Settings saved!", "success");
    } catch {
      showToast("Failed to save", "error");
    }
    
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Settings";
  });
}

function showToast(message: string, type: "success" | "error" = "success") {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}
