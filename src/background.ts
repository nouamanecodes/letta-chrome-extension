/**
 * Background Service Worker for Letta Chrome Extension
 * 
 * Handles message capture to Letta API.
 * Uses /messages/capture endpoint (no LLM invocation).
 * Sleeptime agent processes captured messages in the background.
 */

import { LettaAPIService } from "./services/letta-api";
import { getSettings } from "./utils/storage";
import type { LettaSyncMessage, LettaSyncResponse, CaptureTarget } from "./types";

// --- Constants ---
const SYNC_COOLDOWN_MS = 2000;
const CONTEXT_PATTERNS = [
  "<memory>",
  "<user_context>",
  "LETTA MEMORY CONTEXT",
  "🧠 Letta",
  "[persona]",
  "[human]",
];

// --- State ---
let lastSyncTime = 0;
let lastCapturedHash: string | null = null;

// --- Platform Detection ---
function detectPlatform(url: string): CaptureTarget | null {
  if (!url) return null;
  
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
  if (url.includes("claude.ai")) return "claude";
  if (url.includes("perplexity.ai")) return "perplexity";
  if (url.includes("gemini.google.com")) return "gemini";
  
  return null;
}

// --- Message Handler ---
async function handleSync(payload: LettaSyncMessage["payload"]): Promise<LettaSyncResponse> {
  // Rate limiting check (don't update timestamp yet)
  const now = Date.now();
  if (now - lastSyncTime < SYNC_COOLDOWN_MS) {
    return { success: false, error: "Rate limited" };
  }

  // Load settings
  const settings = await getSettings();
  
  if (!settings.apiKey || !settings.agentId) {
    return { success: false, error: "Not configured" };
  }

  // Platform check
  const platform = detectPlatform(payload.url);
  if (!platform) {
    return { success: false, error: "Unknown platform" };
  }
  
  if (!settings.captureTargets.includes(platform)) {
    return { success: false, error: "Capture disabled" };
  }

  // Skip if message contains injected Letta context
  for (const pattern of CONTEXT_PATTERNS) {
    if (payload.userMessage.includes(pattern)) {
      return { success: false, error: "Contains Letta context" };
    }
  }

  // Skip empty messages
  if (!payload.userMessage.trim()) {
    return { success: false, error: "Empty message" };
  }

  // Deduplication
  const msgHash = payload.userMessage.slice(0, 200);
  if (msgHash === lastCapturedHash) {
    return { success: false, error: "Duplicate message" };
  }

  // All validations passed - now update rate limit timestamp
  lastSyncTime = now;

  // Capture the message
  try {
    const apiService = new LettaAPIService(settings.apiKey);
    const messages = [
      ...(payload.context || []),
      { role: "user" as const, content: payload.userMessage }
    ];

    await apiService.captureMessages(settings.agentId, messages, platform);
    
    lastCapturedHash = msgHash;
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener(
  (
    message: LettaSyncMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: LettaSyncResponse) => void
  ) => {
    if (message.type === "LETTA_SYNC") {
      handleSync(message.payload)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }
    return false;
  }
);
