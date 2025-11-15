/**
 * Aspect-Oriented Logger Utility
 *
 * Provides namespace-based logging with configurable levels and filtering.
 * Follows aspect-oriented principles by separating logging concerns from
 * business logic.
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/utils/logger';
 *
 * const logger = createLogger('EditorCore');
 * logger.debug('Document changed', { docVersion: 5 });
 * logger.info('Lock registered', { lockId: 'lock_001' });
 * logger.warn('Transaction blocked', { reason: 'affects locked content' });
 * logger.error('Failed to apply lock', error);
 * ```
 *
 * Configuration:
 * - Set `import.meta.env.VITE_LOG_LEVEL` to control global log level
 * - Set `import.meta.env.VITE_LOG_NAMESPACES` to filter namespaces (comma-separated)
 *
 * @module utils/logger
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LoggerConfig {
  level: LogLevel;
  namespaces: string[];
  enableAll: boolean;
}

/**
 * Global logger configuration.
 * Can be overridden via environment variables or programmatically.
 */
const isTestEnv = import.meta.env.MODE === "test" || Boolean(import.meta.env.VITEST);
const config: LoggerConfig = {
  level: isTestEnv ? LogLevel.ERROR : import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  namespaces: [],
  enableAll: !isTestEnv && import.meta.env.DEV, // Disable noisy logs in test runs
};

// Parse VITE_LOG_LEVEL environment variable
if (import.meta.env.VITE_LOG_LEVEL) {
  const levelStr = import.meta.env.VITE_LOG_LEVEL.toUpperCase();
  config.level = LogLevel[levelStr as keyof typeof LogLevel] ?? LogLevel.DEBUG;
}

// Parse VITE_LOG_NAMESPACES environment variable
if (import.meta.env.VITE_LOG_NAMESPACES) {
  config.namespaces = import.meta.env.VITE_LOG_NAMESPACES.split(",").map((ns: string) => ns.trim());
  config.enableAll = false; // Disable enableAll when specific namespaces are configured
}

/**
 * Logger instance for a specific namespace.
 */
export interface Logger {
  /**
   * Log debug-level message (for detailed troubleshooting).
   * Only visible when LOG_LEVEL=DEBUG.
   */
  debug(message: string, data?: unknown): void;

  /**
   * Log info-level message (for general information).
   * Visible when LOG_LEVEL=INFO or DEBUG.
   */
  info(message: string, data?: unknown): void;

  /**
   * Log warning-level message (for recoverable issues).
   * Visible when LOG_LEVEL=WARN, INFO, or DEBUG.
   */
  warn(message: string, data?: unknown): void;

  /**
   * Log error-level message (for critical failures).
   * Always visible unless LOG_LEVEL=NONE.
   */
  error(message: string, data?: unknown): void;

  /** Emit structured event logs */
  event(event: string, payload?: Record<string, unknown>): void;
}

/**
 * Check if a namespace is enabled for logging.
 */
function isNamespaceEnabled(namespace: string): boolean {
  if (config.enableAll) return true;
  if (config.namespaces.length === 0) return false;
  return config.namespaces.some((ns) => namespace.startsWith(ns));
}

/**
 * Format log message with namespace prefix and optional data.
 */
function formatMessage(namespace: string, message: string, data?: unknown): unknown[] {
  const prefix = `[${namespace}]`;
  if (data === undefined) {
    return [prefix, message];
  }
  return [prefix, message, data];
}

/**
 * Create a logger instance for a specific namespace.
 *
 * @param namespace - Logger namespace (e.g., 'EditorCore', 'TransactionFilter')
 * @returns Logger instance with debug/info/warn/error methods
 *
 * @example
 * ```typescript
 * const logger = createLogger('EditorCore');
 * logger.debug('Initializing editor');
 * logger.info('Lock applied', { lockId: 'lock_001' });
 * logger.warn('Transaction blocked');
 * logger.error('Failed to load', error);
 * ```
 */
export function createLogger(namespace: string): Logger {
  const isEnabled = () => isNamespaceEnabled(namespace);

  return {
    debug(message: string, data?: unknown): void {
      if (isEnabled() && config.level <= LogLevel.DEBUG) {
        console.debug(...formatMessage(namespace, message, data));
      }
    },

    info(message: string, data?: unknown): void {
      if (isEnabled() && config.level <= LogLevel.INFO) {
        console.info(...formatMessage(namespace, message, data));
      }
    },

    warn(message: string, data?: unknown): void {
      if (isEnabled() && config.level <= LogLevel.WARN) {
        console.warn(...formatMessage(namespace, message, data));
      }
    },

    error(message: string, data?: unknown): void {
      if (isEnabled() && config.level <= LogLevel.ERROR) {
        console.error(...formatMessage(namespace, message, data));
      }
    },

    event(eventName: string, payload?: Record<string, unknown>): void {
      if (!isEnabled() || config.level > LogLevel.INFO) return;
      const entry = {
        namespace,
        event: eventName,
        timestamp: new Date().toISOString(),
        ...payload,
      };
      console.info(`[${namespace}]`, JSON.stringify(entry));
    },
  };
}

/**
 * Configure logger globally.
 *
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * // Enable only specific namespaces
 * configureLogger({
 *   namespaces: ['EditorCore', 'TransactionFilter'],
 * });
 *
 * // Set global log level
 * configureLogger({
 *   level: LogLevel.WARN,
 * });
 * ```
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  if (options.level !== undefined) {
    config.level = options.level;
  }
  if (options.namespaces !== undefined) {
    config.namespaces = options.namespaces;
    config.enableAll = false;
  }
  if (options.enableAll !== undefined) {
    config.enableAll = options.enableAll;
  }
}
