/**
 * Logger utility for Letta Chrome Extension
 * All logging disabled for production
 */

export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

interface LoggerOptions {
  prefix: string;
  color?: string;
}

/**
 * Create a no-op logger instance
 */
export function createLogger(_options: LoggerOptions) {
  return {
    debug: (_message: string, ..._args: unknown[]) => {},
    info: (_message: string, ..._args: unknown[]) => {},
    success: (_message: string, ..._args: unknown[]) => {},
    warn: (_message: string, ..._args: unknown[]) => {},
    error: (_message: string, ..._args: unknown[]) => {},
    group: (_label: string) => {},
    groupEnd: () => {},
    isDebugEnabled: () => false,
  };
}

/**
 * Update the debug setting (no-op)
 */
export function setDebugEnabled(_enabled: boolean): void {}

/**
 * Force reload debug setting from storage (no-op)
 */
export async function reloadDebugSetting(): Promise<void> {}

// Default logger for general use
export const logger = createLogger({ prefix: "Core" });
