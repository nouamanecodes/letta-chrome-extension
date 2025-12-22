/* File: src/overview.ts */

import type { AgentState, MemoryBlock } from "./types";
import { LettaAPIService } from "./services/letta-api";
import { getStoredData, removeStoredData, setStoredData } from "./utils/storage";
import { AVAILABLE_MODELS } from "./constants";

let apiService: LettaAPIService;
let _currentAgent: AgentState; // Prefixed with _ to indicate intentionally unused for now

document.addEventListener("DOMContentLoaded", async () => {
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
  const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement;
  const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
  const updateModelBtn = document.getElementById("updateModelBtn") as HTMLButtonElement;

  // Check authentication
  const storedData = await getStoredData();
  if (!storedData.lettaApiKey || !storedData.agentId) {
    window.location.href = "popup.html";
    return;
  }

  // Initialize API service
  apiService = new LettaAPIService(storedData.lettaApiKey);

  // Load initial data
  await loadAgentData();

  // Populate model selector
  populateModelSelector();

  // Setup interval settings
  const messageIntervalInput = document.getElementById("messageInterval") as HTMLInputElement;
  const saveIntervalBtn = document.getElementById("saveIntervalBtn") as HTMLButtonElement;

  if (messageIntervalInput) {
    messageIntervalInput.value = String(storedData.messageInterval ?? 10);
  }

  if (saveIntervalBtn) {
    saveIntervalBtn.addEventListener("click", async () => {
      const interval = parseInt(messageIntervalInput.value) || 10;
      const currentData = await getStoredData();
      await setStoredData({
        ...currentData,
        messageInterval: interval,
      });
      saveIntervalBtn.textContent = "Saved!";
      saveIntervalBtn.style.backgroundColor = "#4ade80";
      saveIntervalBtn.style.color = "#000";
      setTimeout(() => {
        saveIntervalBtn.textContent = "Save";
        saveIntervalBtn.style.backgroundColor = "";
        saveIntervalBtn.style.color = "";
      }, 1500);
    });
  }

  // Event listeners
  logoutBtn.addEventListener("click", () => handleLogout());
  refreshBtn.addEventListener("click", () => loadAgentData());

  modelSelect.addEventListener("change", () => {
    updateModelBtn.disabled = false;
  });

  updateModelBtn.addEventListener("click", async () => {
    await handleModelUpdate(storedData.agentId!);
  });
});

async function loadAgentData() {
  const storedData = await getStoredData();

  if (!storedData.lettaApiKey || !storedData.agentId) {
    showError("Agent not configured. Please go back to setup.");
    return;
  }

  try {
    // Update module-level instance with fresh credentials if needed
    apiService = new LettaAPIService(storedData.lettaApiKey);

    // Load agent details
    const agent = await apiService.getAgent(storedData.agentId);

    // Display agent info
    updateAgentInfo(agent);

    // Load memory blocks with error handling
    try {
      const blocks = await apiService.getMemoryBlocks(storedData.agentId);
      displayMemoryBlocks(blocks);
      displayBlockSelection(blocks, storedData.selectedBlocks);
    } catch {
      // Show a message but don't fail the whole page
      displayMemoryBlocksError();
      displayBlockSelectionError();
    }
  } catch (error) {
    showError("Failed to load agent data: " + (error as Error).message);
  }
}

// Add this helper function
function displayMemoryBlocksError() {
  const memoryContainer = document.getElementById("memory-blocks-container");
  if (memoryContainer) {
    memoryContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #888;">
        <p>Memory blocks not available yet.</p>
        <p style="font-size: 12px;">Send a message to ChatGPT to start building memory.</p>
      </div>
    `;
  }
}

// Add missing showError function
function showError(message: string): void {
  const errorContainer = document.getElementById("memory-blocks-container");
  if (errorContainer) {
    // Create elements safely to prevent XSS
    errorContainer.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-state";
    const errorP = document.createElement("p");
    errorP.textContent = message; // textContent escapes HTML
    errorDiv.appendChild(errorP);
    errorContainer.appendChild(errorDiv);
  }
}

function updateAgentInfo(agent: AgentState): void {
  const agentNameEl = document.getElementById("agentName");
  const agentIdEl = document.getElementById("agentId");

  if (agentNameEl) {
    agentNameEl.textContent = agent.name;
  }

  if (agentIdEl) {
    agentIdEl.textContent = agent.id;
  }
}

function populateModelSelector(): void {
  const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
  if (!modelSelect) return;

  // Clear existing options
  modelSelect.innerHTML = "";

  // Add model options grouped by provider
  const providers = [...new Set(AVAILABLE_MODELS.map(m => m.provider))];

  providers.forEach(provider => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = provider;

    const providerModels = AVAILABLE_MODELS.filter(m => m.provider === provider);
    providerModels.forEach(model => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} (${model.contextWindow.toLocaleString()} tokens)`;
      optgroup.appendChild(option);
    });

    modelSelect.appendChild(optgroup);
  });
}

async function handleModelUpdate(agentId: string): Promise<void> {
  const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
  const updateModelBtn = document.getElementById("updateModelBtn") as HTMLButtonElement;

  if (!modelSelect || !updateModelBtn) return;

  const newModelId = modelSelect.value;
  if (!newModelId) return;

  // Find the model to get its full config
  const modelInfo = AVAILABLE_MODELS.find(m => m.id === newModelId);
  if (!modelInfo) {
    return;
  }

  try {
    updateModelBtn.disabled = true;
    updateModelBtn.textContent = "Updating...";

    // Update with just the model name
    await apiService.updateAgentModel(agentId, modelInfo.id);

    // Refresh agent data to get updated info
    _currentAgent = await apiService.getAgent(agentId);

    updateModelBtn.textContent = "Updated!";
    updateModelBtn.style.backgroundColor = "#4ade80";
    updateModelBtn.style.color = "#000";

    setTimeout(() => {
      updateModelBtn.textContent = "Update Model";
      updateModelBtn.style.backgroundColor = "";
      updateModelBtn.style.color = "";
      updateModelBtn.disabled = true;
    }, 2000);
  } catch {
    updateModelBtn.textContent = "Failed";
    updateModelBtn.style.backgroundColor = "#ef4444";

    setTimeout(() => {
      updateModelBtn.textContent = "Update Model";
      updateModelBtn.style.backgroundColor = "";
      updateModelBtn.disabled = false;
    }, 2000);
  }
}

function displayMemoryBlocks(blocks: MemoryBlock[]): void {
  const container = document.getElementById("memory-blocks-container");
  if (!container) return;

  container.innerHTML = "";

  if (blocks.length === 0) {
    container.innerHTML = '<div class="loading-state"><p>No memory blocks found</p></div>';
    return;
  }

  blocks.forEach(block => {
    const blockEl = document.createElement("div");
    blockEl.className = "memory-block";

    const headerEl = document.createElement("div");
    headerEl.className = "memory-block-header";

    const labelEl = document.createElement("div");
    labelEl.className = "memory-block-label";
    labelEl.textContent = block.label;

    const metaEl = document.createElement("div");
    metaEl.className = "memory-block-meta";
    metaEl.textContent = `${block.value.length} / ${block.limit} chars`;

    headerEl.appendChild(labelEl);
    headerEl.appendChild(metaEl);

    const valueEl = document.createElement("div");
    valueEl.className = "memory-block-value";
    valueEl.textContent = block.value;

    blockEl.appendChild(headerEl);
    blockEl.appendChild(valueEl);

    container.appendChild(blockEl);
  });
}

// Reserved for future use
function _showLoadingState(): void {
  const container = document.getElementById("memory-blocks-container");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading memory blocks...</p>
    </div>
  `;
}

function _showErrorState(message: string): void {
  const container = document.getElementById("memory-blocks-container");
  if (!container) return;

  container.innerHTML = "";
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-state";
  const errorP = document.createElement("p");
  errorP.textContent = message;
  errorDiv.appendChild(errorP);
  container.appendChild(errorDiv);
}

async function handleLogout(): Promise<void> {
  if (confirm("Are you sure you want to disconnect? This will not delete your agent.")) {
    await removeStoredData([
      "lettaApiKey",
      "agentId",
      "agentName",
      "messageInterval",
      "selectedBlocks",
    ]);
    window.location.href = "popup.html";
  }
}

// Block selection descriptions
const BLOCK_DESCRIPTIONS: Record<string, string> = {
  user_context: "Core user info - background, preferences, goals",
  active_topics: "Current projects and interests",
  facts: "Specific facts - names, dates, decisions",
  conversation_patterns: "How user prefers AI responses",
  extraction_log: "Recent extractions for debugging",
  // Legacy blocks (for backwards compatibility)
  persona: "AI personality and behavior guidelines",
  human: "Information about the user",
  conversation_context: "Current conversation state and topics",
  learned_preferences: "User preferences learned over time",
  knowledge_store: "Facts and domain knowledge",
};

function displayBlockSelection(blocks: MemoryBlock[], selectedBlocks?: string[]): void {
  const container = document.getElementById("blockSelectionContainer");
  if (!container) return;

  container.innerHTML = "";

  // Default to all blocks selected if none specified
  const selected = selectedBlocks ?? blocks.map(b => b.label);

  blocks.forEach(block => {
    const item = document.createElement("label");
    item.className = "block-checkbox-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.includes(block.label);
    checkbox.dataset.label = block.label;

    const labelDiv = document.createElement("div");
    labelDiv.className = "block-checkbox-label";

    const nameSpan = document.createElement("span");
    nameSpan.className = "block-checkbox-name";
    nameSpan.textContent = block.label;

    const descSpan = document.createElement("span");
    descSpan.className = "block-checkbox-desc";
    descSpan.textContent = BLOCK_DESCRIPTIONS[block.label] || block.description || "Memory block";

    labelDiv.appendChild(nameSpan);
    labelDiv.appendChild(descSpan);

    item.appendChild(checkbox);
    item.appendChild(labelDiv);

    // Save on change
    checkbox.addEventListener("change", async () => {
      await saveBlockSelection();
    });

    container.appendChild(item);
  });
}

async function saveBlockSelection(): Promise<void> {
  const container = document.getElementById("blockSelectionContainer");
  if (!container) return;

  const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const selected: string[] = [];

  checkboxes.forEach(cb => {
    if (cb.checked && cb.dataset.label) {
      selected.push(cb.dataset.label);
    }
  });

  const currentData = await getStoredData();
  await setStoredData({
    ...currentData,
    selectedBlocks: selected,
  });
}

function displayBlockSelectionError(): void {
  const container = document.getElementById("blockSelectionContainer");
  if (container) {
    container.innerHTML = '<p class="loading-text">Could not load blocks</p>';
  }
}
