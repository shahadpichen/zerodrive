/**
 * Session Manager
 * Handles session storage for account switching detection
 */

/**
 * Store the current session's user email
 */
export const setSessionUser = (email: string): void => {
  sessionStorage.setItem("session-user-email", email);
};

/**
 * Get the session's stored user email
 */
export const getSessionUser = (): string | null => {
  return sessionStorage.getItem("session-user-email");
};

/**
 * Clear all session data
 */
export const clearSession = (): void => {
  sessionStorage.clear();
};
