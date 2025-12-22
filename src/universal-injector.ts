/**
 * Universal Content Script for Letta Chrome Extension
 *
 * Supported platforms: ChatGPT, Claude, Gemini, Perplexity
 *
 * Features:
 * - Single button inside input area
 * - One-click memory injection
 * - Automatic message capture and sync to Letta
 */

import { getSettings } from "./utils/storage";
import type { Settings, LettaSyncMessage, MemoryBlock, ChatMessage } from "./types";
import { LettaAPIService, setApiDebug } from "./services/letta-api";
import { createLogger, setDebugEnabled } from "./utils/logger";
import { THEME } from "./constants";

// Import from new unified handlers
import {
  detectPlatform,
  getTextarea,
  getSendButton,
  getAnchor,
  Platform,
} from "./utils/dom-handlers";
import {
  injectMemories as doInjectMemories,
  clearMemoriesFromInput,
  extractUserMessage,
  resetInjectionState,
} from "./utils/memory-injection";

// --- State ---
let apiService: LettaAPIService | null = null;
let agentId: string | null = null;
let settings: Settings | null = null;
let cachedBlocks: MemoryBlock[] = [];
let platform: Platform = null;
let buttonHost: HTMLElement | null = null;
let inputValueCopy = "";

// Logger instance
let log: ReturnType<typeof createLogger>;

// Cleanup tracking
let buttonWatcherStarted = false;
let buttonWatcherInterval: number | null = null;
let urlMonitorInterval: number | null = null;
let mutationObserver: MutationObserver | null = null;
let captureObserver: MutationObserver | null = null;

// Message selectors per platform
const MESSAGE_SELECTORS: Record<string, { user: string; assistant: string }> = {
  chatgpt: {
    user: "[data-message-author-role='user']",
    assistant: "[data-message-author-role='assistant']",
  },
  claude: {
    user: ".font-user-message",
    assistant: ".font-claude-message",
  },
  gemini: {
    user: ".query-content, .user-query",
    assistant: ".model-response-text, .response-container",
  },
  perplexity: {
    user: "[data-testid='user-message'], .prose.user",
    assistant: "[data-testid='assistant-message'], .prose:not(.user)",
  },
};

// --- Initialization ---
async function init(): Promise<void> {
  platform = detectPlatform();

  if (!platform) {
    return; // Not a supported platform
  }

  log = createLogger({
    prefix: platform.charAt(0).toUpperCase() + platform.slice(1),
    color: "#60a5fa",
  });
  log.debug("Initializing...");

  try {
    settings = await getSettings();
    setDebugEnabled(settings.debug);
    setApiDebug(settings.debug);

    // Always setup UI (button) even if not configured
    setupUI();

    if (!settings.apiKey || !settings.agentId) {
      log.warn("Not configured - open extension popup to set up");
      return;
    }

    apiService = new LettaAPIService(settings.apiKey);
    agentId = settings.agentId;

    await refreshBlocks();

    setupMessageCapture();
    setupUrlMonitoring();

    // Setup cleanup on page unload
    window.addEventListener("beforeunload", cleanup);

    log.success(`Initialized on ${platform}`);
  } catch (error) {
    log.error("Initialization failed", error);
    // Still try to setup UI even on error
    setupUI();
  }
}

// --- Cleanup ---
function cleanup(): void {
  if (buttonWatcherInterval) {
    clearInterval(buttonWatcherInterval);
    buttonWatcherInterval = null;
  }
  if (urlMonitorInterval) {
    clearInterval(urlMonitorInterval);
    urlMonitorInterval = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (captureObserver) {
    captureObserver.disconnect();
    captureObserver = null;
  }
  removeUI();
}

/**
 * Remove the UI and clean up any listeners
 */
function removeUI(): void {
  // Check for floating container specifically
  const floatCont = document.getElementById("letta-floating-container");
  if (floatCont) {
    const c = floatCont as HTMLElement & { _cleanup?: () => void };
    if (typeof c._cleanup === "function") {
      c._cleanup();
    }
    c.remove();
  }

  if (buttonHost) {
    const root = buttonHost.parentElement;
    if (root) {
      // Check for cleanup on the wrapper root
      const c = root as HTMLElement & { _cleanup?: () => void };
      if (typeof c._cleanup === "function") {
        c._cleanup();
      }

      // Remove the root element (our wrapper span)
      if (root.isConnected) {
        root.remove();
      }
    }
    buttonHost = null;
  }
}

// --- Block Management ---
async function refreshBlocks(): Promise<void> {
  if (!apiService || !agentId) return;

  try {
    const blocks = await apiService.getMemoryBlocks(agentId);
    // Convert to MemoryBlock type
    cachedBlocks = blocks.map(b => ({
      id: b.id,
      label: b.label,
      value: b.value,
      description: b.description,
      limit: b.limit,
    }));
    log.debug(`Loaded ${cachedBlocks.length} memory blocks`);
  } catch (error) {
    log.error("Failed to fetch blocks", error);
  }
}

// --- Memory Injection ---
function injectMemories(): void {
  if (cachedBlocks.length === 0) {
    showToast("No memory blocks available - refreshing...");
    refreshBlocks().then(() => {
      if (cachedBlocks.length > 0) {
        injectMemories(); // Retry after refresh
      } else {
        showToast("No memory blocks found", "error");
      }
    });
    return;
  }

  // Filter by enabled blocks from settings
  const enabledLabels = settings?.enabledBlocks || [];
  const blocksToInject =
    enabledLabels.length > 0
      ? cachedBlocks.filter(b => enabledLabels.includes(b.label))
      : cachedBlocks; // If no enabled blocks set, use all

  if (blocksToInject.length === 0) {
    showToast("No blocks enabled - check popup settings");
    return;
  }

  const success = doInjectMemories(blocksToInject);

  if (success) {
    log.success(`Injected ${blocksToInject.length} memories`);
    showToast(`Added ${blocksToInject.length} memory blocks`, "success");
  } else {
    log.error("Memory injection failed");
    showToast("Failed to inject memories", "error");
  }
}

// --- UI Setup ---
function setupUI(): void {
  injectStyles();
  mountButtonOnEditor();
}

/**
 * Mount the Letta button near the input area
 * Platform-specific mounting strategies
 */
function mountButtonOnEditor(): void {
  if (
    document.getElementById("letta-icon-button") ||
    document.getElementById("letta-floating-container")
  )
    return;

  // Ensure strict cleanup before attempting mount
  if (buttonHost) {
    removeUI();
  }

  let success = false;

  switch (platform) {
    case "chatgpt":
      success = mountChatGPTButton();
      break;
    case "claude":
      success = mountClaudeButton();
      break;
    case "gemini":
      success = mountGeminiButton();
      break;
    case "perplexity":
      success = mountPerplexityButton();
      break;
    default:
      success = mountGenericButton();
  }

  if (!success) {
    // Retry after delay
    setTimeout(mountButtonOnEditor, 1000);
  }

  // Start button watcher only once
  if (!buttonWatcherStarted) {
    buttonWatcherStarted = true;
    startButtonWatcher();
  }
}

/**
 * Watch for button removal and re-add it
 */
function startButtonWatcher(): void {
  // MutationObserver to detect when button is removed
  mutationObserver = new MutationObserver(() => {
    if (
      !document.getElementById("letta-icon-button") &&
      !document.getElementById("letta-floating-container")
    ) {
      // If elements are missing but we have a reference, clean it up first (to kill listeners)
      if (buttonHost) removeUI();
      mountButtonOnEditor();
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also periodic check as fallback
  buttonWatcherInterval = window.setInterval(() => {
    if (
      !document.getElementById("letta-icon-button") &&
      !document.getElementById("letta-floating-container")
    ) {
      if (buttonHost) removeUI();
      mountButtonOnEditor();
    }
  }, 2000);
}

/**
 * Create the Letta icon button (logo only)
 */
function createLettaButton(): { root: HTMLElement; button: HTMLButtonElement } {
  const root = document.createElement("span");
  root.style.cssText = "position: relative; display: inline-flex; flex-shrink: 0;";

  const button = document.createElement("button");
  button.id = "letta-icon-button";
  button.type = "button";
  button.title = "Add Letta Memory";
  button.setAttribute("aria-label", "Add Letta memories to your prompt");

  // Icon button styles - small with grey backdrop
  button.style.cssText = `
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 24px !important;
    height: 24px !important;
    border-radius: 6px !important;
    background: rgba(128, 128, 128, 0.2) !important;
    border: none !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
    padding: 2px !important;
  `;

  // Letta logo SVG - black color, smaller
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 22 22" fill="#000000">
      <path d="M13.2017 8.80036H8.80133V13.2002H13.2017V8.80036Z"></path>
      <path d="M17.6019 2.99742V0H4.40033V2.99742C4.40033 3.77228 3.77267 4.39988 2.99773 4.39988H0V17.6001H2.99773C3.77267 17.6001 4.40033 18.2277 4.40033 19.0026V22H17.6019V19.0026C17.6019 18.2277 18.2296 17.6001 19.0045 17.6001H22.0023V4.39988H19.0045C18.2296 4.39988 17.6019 3.77228 17.6019 2.99742ZM17.6019 16.1971C17.6019 16.9719 16.9743 17.5995 16.1993 17.5995H5.80355C5.0286 17.5995 4.40094 16.9719 4.40094 16.1971V5.80234C4.40094 5.02747 5.0286 4.39988 5.80355 4.39988H16.1993C16.9743 4.39988 17.6019 5.02747 17.6019 5.80234V16.1971Z"></path>
    </svg>
  `;

  // Hover effects
  button.addEventListener("mouseenter", () => {
    button.style.background = "rgba(168, 85, 247, 0.15)";
    button.style.transform = "scale(1.1)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "rgba(128, 128, 128, 0.2)";
    button.style.transform = "scale(1)";
  });

  button.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    injectMemories();
  });

  root.appendChild(button);
  return { root, button };
}

// ============================================================================
// CHATGPT - Insert before send button
// ============================================================================
function mountChatGPTButton(): boolean {
  // Strategy 1: Find plus button and insert after its parent span
  const plusButton = document.querySelector(
    'button[data-testid="composer-plus-btn"]'
  ) as HTMLElement;
  if (plusButton) {
    const plusButtonParent = plusButton.closest("span.flex") as HTMLElement;
    const leadingContainer = plusButton.closest('div[class*="leading"]') as HTMLElement;

    if (plusButtonParent?.parentElement) {
      const { root, button } = createLettaButton();
      plusButtonParent.parentElement.insertBefore(root, plusButtonParent.nextSibling);

      // Apply flex layout to container
      plusButtonParent.parentElement.style.cssText += `
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 8px !important;
      `;

      buttonHost = button;
      log.debug("ChatGPT button mounted (after plus button)");
      return true;
    } else if (leadingContainer) {
      const { root, button } = createLettaButton();
      leadingContainer.appendChild(root);
      buttonHost = button;
      log.debug("ChatGPT button mounted (in leading container)");
      return true;
    }
  }

  // Strategy 2: Fallback to send button
  const sendButton = document.querySelector("#composer-submit-button") as HTMLElement;
  if (sendButton?.parentElement) {
    const { root, button } = createLettaButton();
    sendButton.parentElement.insertBefore(root, sendButton);
    buttonHost = button;
    log.debug("ChatGPT button mounted (before send)");
    return true;
  }

  return false;
}

// ============================================================================
// CLAUDE - Insert before send button
// ============================================================================
function mountClaudeButton(): boolean {
  // Try send button first
  const sendButton = (document.querySelector('button[aria-label="Send Message"]') ||
    document.querySelector('button[aria-label="Send message"]')) as HTMLElement | null;

  if (sendButton?.parentElement) {
    const { root, button } = createLettaButton();
    sendButton.parentElement.insertBefore(root, sendButton);
    buttonHost = button;
    log.debug("Claude button mounted");
    return true;
  }

  // Fallback: after input-tools-menu-trigger
  const toolsTrigger = document.querySelector("#input-tools-menu-trigger");
  if (toolsTrigger?.parentElement) {
    const { root, button } = createLettaButton();
    toolsTrigger.parentElement.insertBefore(root, toolsTrigger.nextSibling);
    buttonHost = button;
    log.debug("Claude button mounted (fallback)");
    return true;
  }

  return false;
}

// ============================================================================
// GEMINI - Insert before main-area or send button
// ============================================================================
function mountGeminiButton(): boolean {
  // Strategy 1: Find .text-input-field-main-area and insert before it
  const mainArea = document.querySelector(".text-input-field-main-area");
  if (mainArea?.parentElement) {
    const { root, button } = createLettaButton();
    mainArea.parentElement.insertBefore(root, mainArea);
    mainArea.parentElement.style.display = "flex";
    mainArea.parentElement.style.alignItems = "center";
    root.style.marginRight = "8px";
    buttonHost = button;
    log.debug("Gemini button mounted (before main-area)");
    return true;
  }

  // Strategy 2: Toolbox drawer
  const toolbox = document.querySelector("toolbox-drawer .toolbox-drawer-container") as HTMLElement;
  if (toolbox) {
    const { root, button } = createLettaButton();
    toolbox.appendChild(root);
    buttonHost = button;
    log.debug("Gemini button mounted (in toolbox)");
    return true;
  }

  // Strategy 3: Before send button
  const sendButton = getSendButton(platform);
  if (sendButton?.parentElement) {
    const { root, button } = createLettaButton();
    sendButton.parentElement.insertBefore(root, sendButton);
    root.style.marginRight = "4px";
    buttonHost = button;
    log.debug("Gemini button mounted (before send)");
    return true;
  }

  return false;
}

// ============================================================================
// PERPLEXITY - Insert after segmented group or in controls row
// ============================================================================
function mountPerplexityButton(): boolean {
  // Strategy 1: Find segmented group (radiogroup) and insert after it
  const studio = document.querySelector('div[data-testid="search-mode-studio"]') as HTMLElement;
  if (studio) {
    const group = studio.closest('[role="radiogroup"]') as HTMLElement;
    if (group) {
      const { root, button } = createLettaButton();
      group.insertAdjacentElement("afterend", root);

      // Ensure parent row has proper flex layout
      const row = group.parentElement as HTMLElement;
      if (row) {
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
      }

      buttonHost = button;
      log.debug("Perplexity button mounted (after radiogroup)");
      return true;
    }
  }

  // Strategy 2: Fallback to controls row
  const controlsRow = document.querySelector("div.gap-xs.flex.items-center") as HTMLElement;
  if (controlsRow) {
    const { root, button } = createLettaButton();
    controlsRow.appendChild(root);
    buttonHost = button;
    log.debug("Perplexity button mounted (in controls row)");
    return true;
  }

  // Strategy 3: Find input and create floating container near it
  const inputEl =
    document.querySelector('div#ask-input[contenteditable="true"]') ||
    document.querySelector("textarea#ask-input") ||
    document.querySelector('div[contenteditable="true"][aria-placeholder^="Ask"]') ||
    document.querySelector('textarea[placeholder^="Ask"]') ||
    (document.querySelector("textarea") as HTMLElement);

  if (inputEl) {
    // Try to find flex parent first
    let current: HTMLElement | null = inputEl as HTMLElement;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      if (style.display === "flex") {
        const { root, button } = createLettaButton();
        current.insertBefore(root, current.firstChild);
        current.style.cssText +=
          "display: flex !important; align-items: center !important; gap: 8px !important;";
        buttonHost = button;
        log.debug("Perplexity button mounted (in flex parent)");
        return true;
      }
      current = current.parentElement;
    }

    // Create floating container near input with repositioning on scroll/resize
    const { root, button } = createLettaButton();
    root.id = "letta-floating-container";
    root.style.cssText = `
      position: fixed;
      z-index: 10000;
      display: flex;
      gap: 4px;
    `;

    // Position update function
    const updatePosition = () => {
      const rect = inputEl.getBoundingClientRect();
      root.style.top = `${Math.max(10, rect.top - 45)}px`;
      root.style.left = `${Math.max(10, rect.left + 8)}px`;
    };

    // Initial position
    updatePosition();

    // Debounced update for performance
    let rafId: number | null = null;
    const debouncedUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        rafId = null;
      });
    };

    // Add listeners for repositioning
    window.addEventListener("scroll", debouncedUpdate, { passive: true });
    window.addEventListener("resize", debouncedUpdate, { passive: true });

    // Store cleanup function on the element for later removal
    (root as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
      window.removeEventListener("scroll", debouncedUpdate);
      window.removeEventListener("resize", debouncedUpdate);
      if (rafId) cancelAnimationFrame(rafId);
    };

    document.body.appendChild(root);
    buttonHost = button;
    log.debug("Perplexity button mounted (floating near input)");
    return true;
  }

  return false;
}

// ============================================================================
// GENERIC - Fallback using anchor
// ============================================================================
function mountGenericButton(): boolean {
  // Try send button first
  const sendButton = getSendButton(platform);
  if (sendButton?.parentElement) {
    const { root, button } = createLettaButton();
    sendButton.parentElement.insertBefore(root, sendButton);
    buttonHost = button;
    log.debug("Generic button mounted (before send)");
    return true;
  }

  // Fallback to anchor
  const anchor = getAnchor(platform);
  if (anchor) {
    const { root, button } = createLettaButton();
    anchor.appendChild(root);
    buttonHost = button;
    log.debug("Generic button mounted (in anchor)");
    return true;
  }

  return false;
}

function injectStyles(): void {
  if (document.getElementById("letta-injector-styles")) return;

  const style = document.createElement("style");
  style.id = "letta-injector-styles";
  style.textContent = `
    /* Toast Notification */
    .letta-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${THEME.bgSecondary};
      border: 1px solid ${THEME.border};
      color: ${THEME.textPrimary};
      padding: 10px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 999999;
      animation: letta-toast-in 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .letta-toast.error {
      border-color: ${THEME.error};
    }
    
    .letta-toast.success {
      border-color: ${THEME.success};
    }
    
    @keyframes letta-toast-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;

  document.head.appendChild(style);
}

function showToast(message: string, type: "info" | "error" | "success" = "info"): void {
  document.getElementById("letta-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "letta-toast";
  toast.className = `letta-toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s";
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// --- Message Capture ---
function setupMessageCapture(): void {
  addSendListeners();

  // Re-check for new elements periodically (SPA navigation)
  captureObserver = new MutationObserver(() => {
    addSendListeners();
  });

  captureObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function addSendListeners(): void {
  // Send button listener
  const sendButton = getSendButton(platform);
  if (sendButton && !sendButton.dataset.lettaListener) {
    sendButton.dataset.lettaListener = "true";
    sendButton.addEventListener("click", handleSend);
  }

  // Textarea key listener
  const textarea = getTextarea(platform);
  if (textarea && !textarea.dataset.lettaKeyListener) {
    textarea.dataset.lettaKeyListener = "true";
    textarea.addEventListener("keydown", handleKeydown);
  }
}

function handleSend(): void {
  // Capture message before it's cleared
  inputValueCopy = extractUserMessage();

  setTimeout(() => {
    captureAndSync();
    clearMemoriesFromInput();
  }, 100);
}

function handleKeydown(e: KeyboardEvent): void {
  // Capture current value on any keydown
  inputValueCopy = extractUserMessage();

  if (e.key === "Enter" && !e.shiftKey) {
    setTimeout(() => {
      captureAndSync();
      clearMemoriesFromInput();
    }, 100);
  }
}

function captureAndSync(): void {
  let message = extractUserMessage();
  if (!message) message = inputValueCopy;

  if (!message?.trim()) return;

  const context = getRecentMessages(2);
  syncToBackground(message.trim(), context);
  inputValueCopy = "";
}

function getRecentMessages(count: number): ChatMessage[] {
  if (!platform) return [];

  const selectors = MESSAGE_SELECTORS[platform];
  if (!selectors) return [];

  const messages: ChatMessage[] = [];

  // Get all message elements and sort by DOM position
  const userElements = Array.from(document.querySelectorAll(selectors.user));
  const assistantElements = Array.from(document.querySelectorAll(selectors.assistant));

  // Combine and sort by DOM position using compareDocumentPosition
  const allElements: Array<{ el: Element; role: "user" | "assistant" }> = [
    ...userElements.map(el => ({ el, role: "user" as const })),
    ...assistantElements.map(el => ({ el, role: "assistant" as const })),
  ];

  // Sort by DOM order
  allElements.sort((a, b) => {
    const position = a.el.compareDocumentPosition(b.el);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  // Get the last N messages
  const recent = allElements.slice(-count);

  for (const { el, role } of recent) {
    const content = el?.textContent?.trim() || "";
    if (content) {
      messages.push({ role, content: content.slice(0, 500) });
    }
  }

  return messages;
}

function syncToBackground(userMessage: string, context: ChatMessage[]): void {
  const message: LettaSyncMessage = {
    type: "LETTA_SYNC",
    payload: {
      userMessage,
      context,
      timestamp: Date.now(),
      url: window.location.href,
    },
  };

  chrome.runtime.sendMessage(message, response => {
    if (chrome.runtime.lastError) {
      log.error("Sync error", chrome.runtime.lastError.message);
      return;
    }

    if (response?.success) {
      log.debug("Message synced to Letta");
      setTimeout(refreshBlocks, 1000);
    }
  });
}

// --- URL Monitoring (for SPA navigation) ---
let lastUrl = window.location.href;

function setupUrlMonitoring(): void {
  urlMonitorInterval = window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;

      // Reset state and proper cleanup
      removeUI();
      resetInjectionState();

      setTimeout(() => {
        mountButtonOnEditor();
        addSendListeners();
      }, 500);
    }
  }, 500);
}

// --- Start ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
