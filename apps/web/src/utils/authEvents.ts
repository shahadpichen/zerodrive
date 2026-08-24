export const AUTH_SESSION_CLEARED_EVENT = "zerodrive-auth-session-cleared";
export const AUTH_SESSION_CLEAR_REQUEST_EVENT =
  "zerodrive-auth-session-clear-request";
export const GOOGLE_DRIVE_PERMISSION_EVENT =
  "zerodrive-google-drive-permission-changed";

export interface AuthSessionClearRequestDetail {
  waitUntil(operation: Promise<unknown>): void;
}

/**
 * Give in-memory workflows a chance to stop while browser credentials and
 * encryption material are still available for safe cleanup.
 */
export async function prepareForAuthSessionClear(): Promise<void> {
  const pending: Promise<unknown>[] = [];
  window.dispatchEvent(
    new CustomEvent<AuthSessionClearRequestDetail>(
      AUTH_SESSION_CLEAR_REQUEST_EVENT,
      {
        detail: {
          waitUntil(operation) {
            pending.push(Promise.resolve(operation));
          },
        },
      },
    ),
  );
  await Promise.allSettled(pending);
}
