/**
 * Memory Injection - Single injection logic for all platforms
 * Uses dom-handlers.ts for platform-specific DOM manipulation
 */

import {
  getTextarea,
  getInputValue,
  setInputValue,
  getContentWithoutMemories,
  detectPlatform,
} from "./dom-handlers";
import { MEMORY_HEADER, MEMORY_FOOTER } from "../constants";
import type { MemoryBlock } from "../types";

// Track injected memories to prevent duplicates
const injectedMemoryIds = new Set<string>();

// ============================================================================
// MEMORY FORMATTING
// ============================================================================

/**
 * Format memory blocks into injection text
 */
export function formatMemoriesForInjection(memories: MemoryBlock[]): string {
  if (!memories || memories.length === 0) return "";

  const lines: string[] = [MEMORY_HEADER, ""];

  memories.forEach(memory => {
    const label = memory.label || "Memory";
    const value = memory.value || "";

    if (value.trim()) {
      lines.push(`[${label}]`);
      lines.push(value);
      lines.push("");
    }
  });

  lines.push(MEMORY_FOOTER);
  lines.push(""); // Trailing newline for user to type after

  return lines.join("\n");
}

// ============================================================================
// INJECTION FUNCTIONS
// ============================================================================

/**
 * Inject memories into the current platform's input
 * Returns true if successful
 */
export function injectMemories(memories: MemoryBlock[]): boolean {
  const platform = detectPlatform();
  if (!platform) {
    return false;
  }

  const textarea = getTextarea(platform);
  if (!textarea) {
    return false;
  }

  // Get existing content (without any previous memory injection)
  const existingContent = getContentWithoutMemories(MEMORY_HEADER);

  // Format new memories
  const memoryText = formatMemoriesForInjection(memories);
  if (!memoryText) {
    return false;
  }

  // Combine: memories first, then existing content
  const newValue = memoryText + existingContent;

  // Set the value using platform-specific handler
  setInputValue(textarea, newValue);

  // Track injected memories
  memories.forEach(m => {
    if (m.id) {
      injectedMemoryIds.add(m.id);
    }
  });

  return true;
}

/**
 * Add a single memory to the input
 * Used when user clicks "Add" on a specific memory
 */
export function addSingleMemory(memory: MemoryBlock): boolean {
  const platform = detectPlatform();
  if (!platform) return false;

  const textarea = getTextarea(platform);
  if (!textarea) return false;

  // Check if already injected
  if (memory.id && injectedMemoryIds.has(memory.id)) {
    return false;
  }

  const currentContent = getInputValue(textarea);

  // Check if we already have memories injected
  if (currentContent.includes(MEMORY_HEADER)) {
    // Insert this memory before the footer
    const footerIndex = currentContent.indexOf(MEMORY_FOOTER);
    if (footerIndex !== -1) {
      const label = memory.label || "Memory";
      const value = memory.value || "";
      const memoryEntry = `\n[${label}]\n${value}\n`;

      const newContent =
        currentContent.substring(0, footerIndex) +
        memoryEntry +
        currentContent.substring(footerIndex);

      setInputValue(textarea, newContent);
    } else {
      // Malformed state: header exists but footer missing
      return false;
    }
  } else {
    // No memories yet, inject this single one
    return injectMemories([memory]);
  }

  if (memory.id) {
    injectedMemoryIds.add(memory.id);
  }

  return true;
}

/**
 * Clear memories from input after sending
 */
export function clearMemoriesFromInput(): void {
  const platform = detectPlatform();
  if (!platform) return;

  const textarea = getTextarea(platform);
  if (!textarea) return;

  // Get content without memories
  const cleanContent = getContentWithoutMemories(MEMORY_HEADER);

  // Set the clean content (empty string if user had no text beyond memories)
  setInputValue(textarea, cleanContent.trim());

  // Clear tracked memories
  injectedMemoryIds.clear();
}

/**
 * Check if memories are currently injected
 */
export function hasMemoriesInjected(): boolean {
  const textarea = getTextarea();
  if (!textarea) return false;

  const content = getInputValue(textarea);
  return content.includes(MEMORY_HEADER);
}

/**
 * Get the user's message without the memory context
 * Call this before capturing the message to send to Letta
 */
export function extractUserMessage(): string {
  return getContentWithoutMemories(MEMORY_HEADER);
}

/**
 * Reset injection state (call on page navigation)
 */
export function resetInjectionState(): void {
  injectedMemoryIds.clear();
}
