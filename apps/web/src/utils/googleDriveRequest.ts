import {
  GOOGLE_TOKEN_REFRESH_BUFFER_MS,
  clearGoogleTokens,
} from "./authService";
import { getGoogleAccessToken } from "./gapiInit";
import logger from "./logger";

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
  const token = await getGoogleAccessToken({
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

export async function googleDriveFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    retryOnAuthFailure?: boolean;
    minTokenValidityMs?: number;
  } = {},
): Promise<Response> {
  const retryOnAuthFailure = options.retryOnAuthFailure !== false;
  const minTokenValidityMs =
    options.minTokenValidityMs ?? GOOGLE_TOKEN_REFRESH_BUFFER_MS;

  const token = await getGoogleAccessToken({
    minValidityMs: minTokenValidityMs,
  });
  if (!token) {
    throw new GoogleDriveRequestError(
      "Google Drive is not connected. Sign in again and retry.",
      401,
    );
  }

  const response = await fetch(input, withAuthorization(init, token));
  if (!retryOnAuthFailure || !isGoogleAuthFailure(response.status)) {
    return response;
  }

  logger.warn("[GoogleDrive] Request failed with auth status; refreshing token", {
    status: response.status,
  });

  const refreshedToken = await getGoogleAccessToken({
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

  return fetch(input, withAuthorization(init, refreshedToken));
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
