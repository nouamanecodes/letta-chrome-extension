// utils/storage.ts
/* File: src/utils/storage.ts */

import type { Settings, StoredData } from "../types";
import { DEFAULT_SETTINGS } from "../types";

/**
 * Utility functions for Chrome storage operations
 */

// Storage key for settings
const SETTINGS_KEY = "letta_settings";

/**
 * Get all settings with defaults applied
 */
export async function getSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.get([SETTINGS_KEY], result => {
      const stored = result[SETTINGS_KEY] || {};
      // Merge with defaults to ensure all fields exist
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

/**
 * Save settings (partial update)
 */
export async function saveSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };

  return new Promise(resolve => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: updated }, () => {
      resolve(updated);
    });
  });
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<Settings> {
  return new Promise(resolve => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, () => {
      resolve(DEFAULT_SETTINGS);
    });
  });
}

/**
 * Clear all Letta extension data (settings and onboarding state)
 * Only removes extension-specific keys, not all chrome storage
 */
export async function clearAllExtensionData(): Promise<void> {
  return new Promise(resolve => {
    // Clear sync storage (settings)
    chrome.storage.sync.remove([SETTINGS_KEY], () => {
      // Clear local storage (onboarding state)
      chrome.storage.local.remove(["onboardingComplete"], () => {
        resolve();
      });
    });
  });
}

/**
 * Export settings as JSON string
 */
export async function exportSettings(): Promise<string> {
  const settings = await getSettings();
  // Remove sensitive data
  const exportable = { ...settings, apiKey: "" };
  return JSON.stringify(exportable, null, 2);
}

// --- Legacy compatibility ---

export async function getStoredData(): Promise<StoredData> {
  const settings = await getSettings();
  return {
    lettaApiKey: settings.apiKey,
    agentId: settings.agentId,
    agentName: settings.agentName,
    selectedBlocks: settings.enabledBlocks,
  };
}

export async function setStoredData(data: Partial<StoredData>): Promise<void> {
  const updates: Partial<Settings> = {};
  if (data.lettaApiKey !== undefined) updates.apiKey = data.lettaApiKey;
  if (data.agentId !== undefined) updates.agentId = data.agentId;
  if (data.agentName !== undefined) updates.agentName = data.agentName;
  if (data.selectedBlocks !== undefined) updates.enabledBlocks = data.selectedBlocks;
  await saveSettings(updates);
}

export async function removeStoredData(keys: string[]): Promise<void> {
  // For legacy compatibility, reset specific fields
  const updates: Partial<Settings> = {};
  if (keys.includes("lettaApiKey")) updates.apiKey = "";
  if (keys.includes("agentId")) updates.agentId = "";
  if (keys.includes("agentName")) updates.agentName = "";
  if (keys.includes("selectedBlocks")) updates.enabledBlocks = [];
  await saveSettings(updates);
}
