/**
 * Platform-specific DOM handlers for Letta Chrome Extension
 * Handles textarea detection, button placement, and input manipulation
 */

import { MEMORY_HEADER, MEMORY_FOOTER } from "../constants";

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

export type Platform = "chatgpt" | "claude" | "gemini" | "perplexity" | null;

export function detectPlatform(): Platform {
  const hostname = window.location.hostname;

  if (hostname.includes("chat.openai.com") || hostname.includes("chatgpt.com")) {
    return "chatgpt";
  }
  if (hostname.includes("claude.ai")) {
    return "claude";
  }
  if (hostname.includes("gemini.google.com")) {
    return "gemini";
  }
  if (hostname.includes("perplexity.ai")) {
    return "perplexity";
  }

  return null;
}

// ============================================================================
// TEXTAREA SELECTORS
// ============================================================================

const TEXTAREA_SELECTORS: Record<string, string[]> = {
  chatgpt: [
    "#prompt-textarea",
    'div[contenteditable="true"][data-id="root"]',
    'div[contenteditable="true"]',
    "textarea",
  ],
  claude: [
    // Primary: ProseMirror editor (most common)
    'div[contenteditable="true"].ProseMirror',
    // Fallback selectors
    'div[contenteditable="true"]',
    "textarea",
    'p[data-placeholder="How can I help you today?"]',
    'p[data-placeholder="Reply to Claude..."]',
  ],
  gemini: [
    'rich-textarea .ql-editor[contenteditable="true"]',
    "rich-textarea .ql-editor.textarea",
    '.ql-editor[aria-label="Enter a prompt here"]',
    ".ql-editor.textarea.new-input-ui",
    ".text-input-field_textarea .ql-editor",
    'div[contenteditable="true"][role="textbox"][aria-label="Enter a prompt here"]',
  ],
  perplexity: [
    'div#ask-input[contenteditable="true"]',
    "textarea#ask-input",
    'div[contenteditable="true"][aria-placeholder^="Ask"]',
    'textarea[placeholder^="Ask"]',
    'textarea[placeholder^="Ask a follow-up"]',
    'div[contenteditable="true"]',
    "textarea",
  ],
};

// ============================================================================
// SEND BUTTON SELECTORS
// ============================================================================

const SEND_BUTTON_SELECTORS: Record<string, string[]> = {
  chatgpt: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'form button[type="submit"]',
  ],
  claude: [
    'button[aria-label="Send Message"]',
    'button[aria-label="Send message"]',
    "fieldset button:not([aria-label])",
    'button:has(svg[viewBox="0 0 256 256"])',
  ],
  gemini: [
    'button[aria-label="Send message"]',
    'button[data-testid="send-button"]',
    'button[type="submit"]:not([aria-label*="attachment"])',
    ".send-button",
    'button[aria-label*="Send"]',
    'button[title*="Send"]',
  ],
  perplexity: [
    'button[data-cy="ai-prompt-submit"]',
    'button[data-cy="ai-chat-send-button"]',
    'button[aria-label="Send"]',
    'button[type="button"][aria-label="Send"]',
    'button[aria-label="Submit"]',
    'button[type="submit"]',
  ],
};

// ============================================================================
// ANCHOR DERIVATION (for button placement)
// ============================================================================

/**
 * Derive anchor element for button placement
 * Platform-specific anchor derivation patterns
 */
function deriveAnchor(platform: Platform, editor: Element): Element | null {
  switch (platform) {
    case "chatgpt": {
      const form = editor.closest("form");
      if (form) {
        // Try to find the toolbar area
        const toolbar =
          form.querySelector('[data-testid="composer-trailing-actions"]') ||
          form.querySelector(".composer-trailing-actions") ||
          form.querySelector(".items-center.gap-1\\.5") ||
          form.querySelector(".items-center.gap-2");
        if (toolbar) return toolbar;
      }
      return form || editor.parentElement;
    }

    case "claude": {
      // Claude uses floating placement near the editor
      return editor.closest("form") || editor.parentElement;
    }

    case "gemini": {
      // Gemini has a toolbox drawer
      const toolbox = document.querySelector("toolbox-drawer .toolbox-drawer-container");
      if (toolbox) return toolbox;
      return editor.closest("form") || editor.parentElement;
    }

    case "perplexity":
    default:
      return editor.closest("form") || editor.parentElement;
  }
}

// Fallback anchor selectors if deriveAnchor fails
const FALLBACK_ANCHORS: Record<string, string[]> = {
  chatgpt: [
    'form [data-testid="composer-trailing-actions"]',
    "form .composer-trailing-actions",
    "form textarea",
    "main form textarea",
  ],
  claude: ["#input-tools-menu-trigger", 'button[aria-label*="Send" i]', "fieldset"],
  gemini: [
    "toolbox-drawer .toolbox-drawer-container",
    ".input-area-container",
    ".text-input-field",
  ],
  perplexity: ['button[aria-label="Submit"]', "form"],
};

// ============================================================================
// DOM FINDER FUNCTIONS
// ============================================================================

/**
 * Find textarea/input element for the current platform
 * Tries multiple selectors in order of priority
 */
export function getTextarea(platform?: Platform): HTMLElement | null {
  const p = platform || detectPlatform();
  if (!p) return null;

  const selectors = TEXTAREA_SELECTORS[p] || [];

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && isVisible(el)) {
        return el;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return null;
}

/**
 * Find send button for the current platform
 */
export function getSendButton(platform?: Platform): HTMLButtonElement | null {
  const p = platform || detectPlatform();
  if (!p) return null;

  const selectors = SEND_BUTTON_SELECTORS[p] || [];

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as HTMLButtonElement | null;
      if (el && isVisible(el)) {
        return el;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return null;
}

/**
 * Find anchor element for button placement
 * Derives anchor from editor element or uses fallback selectors
 */
export function getAnchor(platform?: Platform): HTMLElement | null {
  const p = platform || detectPlatform();
  if (!p) return null;

  // First try to derive anchor from the editor element
  const editor = getTextarea(p);
  if (editor) {
    const derived = deriveAnchor(p, editor);
    if (derived && isVisible(derived as HTMLElement)) {
      return derived as HTMLElement;
    }
  }

  // Fallback to predefined selectors
  const selectors = FALLBACK_ANCHORS[p] || [];
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el && isVisible(el)) {
        return el;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  // Last fallback: use editor's form or parent
  if (editor) {
    return (editor.closest("form") as HTMLElement) || editor.parentElement;
  }

  return null;
}

/**
 * Check if element is visible
 */
function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
  );
}

// ============================================================================
// INPUT VALUE FUNCTIONS
// ============================================================================

/**
 * Set input value - handles both textarea and contenteditable
 * Platform-specific handling for different editor types
 */
export function setInputValue(inputElement: HTMLElement, value: string): void {
  if (!inputElement) return;

  const platform = detectPlatform();
  const tagName = inputElement.tagName.toLowerCase();
  const isContentEditable =
    inputElement.contentEditable === "true" ||
    inputElement.getAttribute("contenteditable") === "true";

  // Claude uses ProseMirror or <p> placeholder elements
  if (platform === "claude") {
    setClaudeInputValue(inputElement, value);
    return;
  }

  // Gemini uses Quill editor
  if (platform === "gemini" && isContentEditable) {
    setGeminiInputValue(inputElement, value);
    return;
  }

  // Generic contenteditable
  if (isContentEditable) {
    setGenericContentEditableValue(inputElement, value);
    return;
  }

  // Regular textarea elements
  if (tagName === "textarea" || tagName === "input") {
    setTextareaValue(inputElement as HTMLTextAreaElement, value);
    return;
  }

  // Fallback
  setGenericContentEditableValue(inputElement, value);
}

/**
 * Claude ProseMirror editor - uses <p> tags with proper structure
 */
function setClaudeInputValue(inputElement: HTMLElement, value: string): void {
  const isProseMirror = inputElement.classList.contains("ProseMirror");
  const isParagraph = inputElement.tagName.toLowerCase() === "p";

  // Build HTML content with proper <p> tags
  const lines = value.split("\n");
  let htmlContent = "";

  lines.forEach(line => {
    if (line.trim() === "") {
      htmlContent += "<p><br></p>";
    } else {
      // Escape HTML entities
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      htmlContent += `<p>${escaped}</p>`;
    }
  });

  if (isParagraph) {
    // For <p> placeholder elements, we need to set content on parent
    const parent = inputElement.parentElement;
    if (parent && parent.getAttribute("contenteditable") === "true") {
      parent.innerHTML = htmlContent;
      inputElement = parent;
    } else {
      // Just set text content on the <p> itself
      inputElement.textContent = value;
    }
  } else {
    // For ProseMirror and contenteditable divs
    inputElement.innerHTML = htmlContent;
  }

  // Dispatch proper events for ProseMirror
  if (isProseMirror) {
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
    });
    inputElement.dispatchEvent(inputEvent);

    // Also dispatch a change event
    const changeEvent = new Event("change", { bubbles: true });
    inputElement.dispatchEvent(changeEvent);
  } else {
    // Standard input event for other contenteditable
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Focus and set cursor to end
  inputElement.focus();
  setCursorToEnd(inputElement);
}

/**
 * Gemini Quill editor - uses <p> tags
 */
function setGeminiInputValue(inputElement: HTMLElement, value: string): void {
  // Clear existing content
  inputElement.innerHTML = "";

  // Split the value by newlines and create paragraph elements
  const lines = value.split("\n");
  lines.forEach(line => {
    const p = document.createElement("p");
    if (line.trim() === "") {
      p.innerHTML = "<br>";
    } else {
      p.textContent = line;
    }
    inputElement.appendChild(p);
  });

  // Trigger input event
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));

  // Focus and set cursor to end
  inputElement.focus();
  setCursorToEnd(inputElement);
}

/**
 * Generic contenteditable handler
 */
function setGenericContentEditableValue(inputElement: HTMLElement, value: string): void {
  // Clear existing content
  inputElement.innerHTML = "";

  // Split the value by newlines and create paragraph elements
  const lines = value.split("\n");
  lines.forEach(line => {
    const p = document.createElement("p");
    if (line.trim() === "") {
      p.innerHTML = "<br>";
    } else {
      p.textContent = line;
    }
    inputElement.appendChild(p);
  });

  // Trigger input event
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));

  // Focus and set cursor to end
  inputElement.focus();
  setCursorToEnd(inputElement);
}

/**
 * Textarea value setter with React compatibility
 */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  // Use native setter for React compatibility
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  // Trigger events for React
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));

  // Focus
  textarea.focus();
}

/**
 * Get current input value
 * Handles ProseMirror, contenteditable, <p> placeholders, and textareas
 */
export function getInputValue(inputElement?: HTMLElement): string {
  const el = inputElement || getTextarea();
  if (!el) return "";

  const tagName = el.tagName.toLowerCase();
  const isProseMirror = el.classList.contains("ProseMirror");
  const isContentEditable =
    el.contentEditable === "true" || el.getAttribute("contenteditable") === "true";

  // ProseMirror editor
  if (isProseMirror) {
    return el.textContent || "";
  }

  // <p> placeholder elements (Claude)
  if (tagName === "p") {
    return el.textContent || "";
  }

  // Contenteditable divs
  if (isContentEditable) {
    return el.textContent || el.innerText || "";
  }

  // Textarea
  if (tagName === "textarea" || tagName === "input") {
    return (el as HTMLTextAreaElement).value || "";
  }

  return el.textContent || "";
}

/**
 * Set cursor to end of contenteditable element
 */
function setCursorToEnd(element: HTMLElement): void {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false); // Collapse to end
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// ============================================================================
// CONTENT EXTRACTION (for message capture)
// ============================================================================

/**
 * Get content without memory wrappers
 * Used before sending to extract the actual user message
 *
 * Strategy: If the passed memoryHeaderText matches MEMORY_HEADER, use marker-based
 * removal (looks for MEMORY_HEADER...MEMORY_FOOTER). Otherwise, just trim everything
 * after the custom header text. This avoids redundant checks.
 */
export function getContentWithoutMemories(memoryHeaderText: string): string {
  const inputElement = getTextarea();
  if (!inputElement) return "";

  let content = getInputValue(inputElement);

  // Use marker-based removal if using standard markers
  if (memoryHeaderText === MEMORY_HEADER) {
    const startIdx = content.indexOf(MEMORY_HEADER);
    if (startIdx !== -1) {
      const endIdx = content.indexOf(MEMORY_FOOTER);
      if (endIdx !== -1 && endIdx > startIdx) {
        // Remove the memory block between markers
        content = content.substring(0, startIdx) + content.substring(endIdx + MEMORY_FOOTER.length);
      } else {
        // No footer found - remove from header to end
        content = content.substring(0, startIdx);
      }
    }
  } else {
    // Custom header - just remove everything from header onwards
    const prefixIndex = content.indexOf(memoryHeaderText);
    if (prefixIndex !== -1) {
      content = content.substring(0, prefixIndex);
    }
  }

  return content.trim();
}
