import {
  GOOGLE_TOKEN_REFRESH_BUFFER_MS,
  clearGoogleTokens,
  getOrFetchGoogleToken,
} from "./authService";
import logger from "./logger";

const DEFAULT_GOOGLE_DRIVE_REQUEST_TIMEOUT_MS = 30_000;

export class GoogleDriveRequestError extends Error {
  public status: number;
  public responseText?: string;

  constructor(message: string, status: number, responseText?: string) {
    super(message);
    this.name = "GoogleDriveRequestError";
    this.status = status;
    this.responseText = responseText;
  }
}

export async function ensureGoogleDriveConnected(
  minTokenValidityMs: number = GOOGLE_TOKEN_REFRESH_BUFFER_MS,
): Promise<void> {
  const token = await getOrFetchGoogleToken({
    minValidityMs: minTokenValidityMs,
  });
  if (!token) {
    throw new GoogleDriveRequestError(
      "Google Drive is not connected. Sign in again and retry.",
      401,
    );
  }
}

function isGoogleAuthFailure(status: number): boolean {
  // Google Drive can return 401 for expired tokens and 403 for auth-related
  // permission/session failures. Retrying once after a forced refresh is safe;
  // persistent 403s still surface to the caller.
  return status === 401 || status === 403;
}

function withAuthorization(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return {
    ...init,
    headers,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new GoogleDriveRequestError(
        "Google Drive did not respond in time. Retry the operation.",
        408,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function googleDriveFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    retryOnAuthFailure?: boolean;
    minTokenValidityMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const retryOnAuthFailure = options.retryOnAuthFailure !== false;
  const minTokenValidityMs =
    options.minTokenValidityMs ?? GOOGLE_TOKEN_REFRESH_BUFFER_MS;
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_GOOGLE_DRIVE_REQUEST_TIMEOUT_MS;

  const token = await getOrFetchGoogleToken({
    minValidityMs: minTokenValidityMs,
  });
  if (!token) {
    throw new GoogleDriveRequestError(
      "Google Drive is not connected. Sign in again and retry.",
      401,
    );
  }

  const response = await fetchWithTimeout(
    input,
    withAuthorization(init, token),
    timeoutMs,
  );
  if (!retryOnAuthFailure || !isGoogleAuthFailure(response.status)) {
    return response;
  }

  logger.warn("[GoogleDrive] Request failed with auth status; refreshing token", {
    status: response.status,
  });

  const refreshedToken = await getOrFetchGoogleToken({
    forceRefresh: true,
    minValidityMs: minTokenValidityMs,
  });
  if (!refreshedToken) {
    clearGoogleTokens();
    throw new GoogleDriveRequestError(
      "Google Drive session expired. Sign in again to reconnect Google Drive.",
      response.status,
    );
  }

  return fetchWithTimeout(
    input,
    withAuthorization(init, refreshedToken),
    timeoutMs,
  );
}

export async function readGoogleDriveError(
  response: Response,
  fallbackMessage: string,
): Promise<GoogleDriveRequestError> {
  let responseText: string | undefined;
  try {
    responseText = await response.text();
  } catch {
    responseText = undefined;
  }

  let detail = response.statusText;
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText) as {
        error?: { message?: string };
      };
      detail = parsed.error?.message || responseText;
    } catch {
      detail = responseText;
    }
  }

  return new GoogleDriveRequestError(
    `${fallbackMessage}: ${detail || response.status}`,
    response.status,
    responseText,
  );
}
