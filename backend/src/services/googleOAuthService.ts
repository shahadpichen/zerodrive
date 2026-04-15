/**
 * Google OAuth Service
 * Handles Google OAuth 2.0 flow for user authentication
 */

import { google } from 'googleapis';
import logger from '../utils/logger';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  logger.error('[OAuth] Missing required Google OAuth environment variables');
  throw new Error('Google OAuth configuration is incomplete');
}

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/**
 * Generate Google OAuth authorization URL
 */
export function getAuthUrl(): string {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file', // ZeroDrive file access
    'https://www.googleapis.com/auth/drive.appdata', // RSA key backup to appDataFolder
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  logger.info('[OAuth] Generated authorization URL');
  return authUrl;
}

/**
 * Exchange authorization code for access tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  scope: string;
}> {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    logger.info('[OAuth] Successfully exchanged code for tokens');

    const result: {
      accessToken: string;
      refreshToken?: string;
      scope: string;
    } = {
      accessToken: tokens.access_token,
      scope: tokens.scope || '',
    };

    if (tokens.refresh_token) {
      result.refreshToken = tokens.refresh_token;
    }

    return result;
  } catch (error) {
    logger.error('[OAuth] Failed to exchange code for tokens', error as Error);
    throw new Error('Failed to get tokens from Google');
  }
}

/**
 * Verify access token and get user information
 */
export async function getUserInfo(accessToken: string): Promise<{
  email: string;
  verified: boolean;
  picture?: string;
  name?: string;
}> {
  try {
    // Set credentials
    oauth2Client.setCredentials({ access_token: accessToken });

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email) {
      throw new Error('No email returned from Google');
    }

    logger.info('[OAuth] Retrieved user info', {
      email: data.email,
      verified: data.verified_email
    });

    return {
      email: data.email,
      verified: data.verified_email || false,
      ...(data.picture && { picture: data.picture }),
      ...(data.name && { name: data.name }),
    };
  } catch (error) {
    logger.error('[OAuth] Failed to get user info', error as Error);
    throw new Error('Failed to verify token with Google');
  }
}

/**
 * Check if granted scopes include full Drive access
 */
export function hasFullDriveScope(grantedScopes: string): boolean {
  return (
    grantedScopes.includes('https://www.googleapis.com/auth/drive.file') ||
    grantedScopes.includes('https://www.googleapis.com/auth/drive')
  );
}

/**
 * Refresh an expired access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
}> {
  try {
    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Request new access token
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token received from refresh');
    }

    logger.info('[OAuth] Successfully refreshed access token');

    return {
      accessToken: credentials.access_token,
    };
  } catch (error) {
    logger.error('[OAuth] Failed to refresh access token', error as Error);
    throw new Error('Failed to refresh Google access token');
  }
}
