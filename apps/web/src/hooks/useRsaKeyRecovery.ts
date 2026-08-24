/**
 * useRsaKeyRecovery Hook
 * Automatically attempts to recover RSA keys from Google Drive on app load
 * if mnemonic is available and keys are missing from IndexedDB
 */

import { useEffect, useRef } from 'react';
import { hasMnemonic } from '../utils/mnemonicManager';
import { recoverRsaKeysIfNeeded } from '../utils/rsaKeyRecovery';
import { getAuthenticatedUser } from '../utils/authService';
import logger from '../utils/logger';

/**
 * Hook that automatically recovers RSA keys on mount if:
 * - Mnemonic is available in memory
 * - User is authenticated
 * - Keys don't exist in IndexedDB
 *
 * Runs silently in the background (no toast notifications)
 * Only runs once per session
 */
export function useRsaKeyRecovery() {
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRunRef.current) {
      return;
    }

    const attemptRecovery = async () => {
      try {
        // Confirm the backend-authenticated account before restoring any
        // account-bound phrase from this tab session. This also clears stale
        // sensitive browser state when another tab changed accounts.
        const authenticatedUser = await getAuthenticatedUser();
        if (!authenticatedUser?.email) {
          logger.log('[useRsaKeyRecovery] User not authenticated, skipping automatic recovery');
          return;
        }

        // Only restore the phrase after the account binding above succeeds.
        if (!hasMnemonic()) {
          logger.log('[useRsaKeyRecovery] Mnemonic not available, skipping automatic recovery');
          return;
        }

        const userEmail = authenticatedUser.email;

        logger.log('[useRsaKeyRecovery] Starting automatic RSA key recovery check...');

        // Attempt recovery (silent mode)
        const result = await recoverRsaKeysIfNeeded(userEmail, true);

        if (result.recovered) {
          logger.log('[useRsaKeyRecovery] Successfully recovered RSA keys automatically');
        } else if (result.keysExisted) {
          logger.log('[useRsaKeyRecovery] RSA keys already exist, no recovery needed');
        } else {
          logger.log('[useRsaKeyRecovery] No RSA keys to recover (user may not have enabled sharing yet)');
        }

        // Mark as run regardless of result
        hasRunRef.current = true;
      } catch (error) {
        logger.error('[useRsaKeyRecovery] Error during automatic recovery:', error);
        // Mark as run even on error to avoid retry loops
        hasRunRef.current = true;
      }
    };

    // Small delay to ensure GAPI is fully initialized
    const timeoutId = setTimeout(attemptRecovery, 1000);

    return () => clearTimeout(timeoutId);
  }, []);
}
