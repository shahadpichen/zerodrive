/**
 * Secure Logger Utility
 * Conditional logging that's disabled in production to prevent sensitive data leakage
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Safe logger that only logs in development mode
 * In production, all logs except errors are disabled
 */
export const logger = {
  /**
   * General logging - disabled in production
   */
  log: (...args: any[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Warning messages - disabled in production
   */
  warn: (...args: any[]): void => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Error messages - always logged (even in production)
   */
  error: (...args: any[]): void => {
    console.error(...args);
  },

  /**
   * Info messages - disabled in production
   */
  info: (...args: any[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Debug messages - disabled in production
   */
  debug: (...args: any[]): void => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * NEVER log sensitive data (no-op in all environments)
   * Use this as a placeholder to remind developers not to log:
   * - Private/public keys
   * - Passwords or tokens
   * - Unencrypted user data
   * - Email addresses (in production)
   */
  sensitive: (..._args: any[]): void => {
    // No-op - never log sensitive data
  },
};

export default logger;
