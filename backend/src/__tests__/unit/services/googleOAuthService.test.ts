/**
 * Unit Tests for Google OAuth Service
 * Tests OAuth URL generation, token exchange, and scope checking
 */

// Mock logger to prevent console noise
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Create mock OAuth2 client
const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockUserinfoGet = jest.fn();

const mockOAuth2Client = {
  generateAuthUrl: mockGenerateAuthUrl,
  getToken: mockGetToken,
  setCredentials: mockSetCredentials,
  refreshAccessToken: mockRefreshAccessToken,
};

// Mock googleapis before importing the service
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => mockOAuth2Client),
    },
    oauth2: jest.fn(() => ({
      userinfo: {
        get: mockUserinfoGet,
      },
    })),
  },
}));

// Import after mocks are set up
import { getAuthUrl, hasFullDriveScope, refreshAccessToken } from '../../../services/googleOAuthService';

describe('GoogleOAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth authorization URL', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?...');

      const url = getAuthUrl();

      expect(url).toBeTruthy();
      expect(typeof url).toBe('string');
      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });

    it('should request correct OAuth scopes including appDataFolder', () => {
      mockGenerateAuthUrl.mockImplementation((options) => {
        expect(options.scope).toContain('https://www.googleapis.com/auth/userinfo.email');
        expect(options.scope).toContain('https://www.googleapis.com/auth/userinfo.profile');
        expect(options.scope).toContain('https://www.googleapis.com/auth/drive.file');
        expect(options.scope).toContain('https://www.googleapis.com/auth/drive.appdata');
        return 'https://accounts.google.com/o/oauth2/auth?...';
      });

      getAuthUrl();

      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });

    it('should set access_type to offline for refresh token', () => {
      mockGenerateAuthUrl.mockImplementation((options) => {
        expect(options.access_type).toBe('offline');
        return 'https://accounts.google.com/o/oauth2/auth?...';
      });

      getAuthUrl();

      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });

    it('should request consent prompt', () => {
      mockGenerateAuthUrl.mockImplementation((options) => {
        expect(options.prompt).toBe('consent');
        return 'https://accounts.google.com/o/oauth2/auth?...';
      });

      getAuthUrl();

      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });

    it('should request exactly 4 scopes', () => {
      mockGenerateAuthUrl.mockImplementation((options) => {
        expect(options.scope).toHaveLength(4);
        return 'https://accounts.google.com/o/oauth2/auth?...';
      });

      getAuthUrl();

      expect(mockGenerateAuthUrl).toHaveBeenCalled();
    });
  });

  describe('hasFullDriveScope', () => {
    it('should return true for drive.file scope', () => {
      const scopes = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file';

      const result = hasFullDriveScope(scopes);

      expect(result).toBe(true);
    });

    it('should return true for full drive scope', () => {
      const scopes = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive';

      const result = hasFullDriveScope(scopes);

      expect(result).toBe(true);
    });

    it('should return false when Drive scope is missing', () => {
      const scopes = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

      const result = hasFullDriveScope(scopes);

      expect(result).toBe(false);
    });

    it('should return false for empty scope string', () => {
      const result = hasFullDriveScope('');

      expect(result).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh and return new access token', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockNewAccessToken = 'mock-new-access-token';

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: mockNewAccessToken,
        },
      });

      const result = await refreshAccessToken(mockRefreshToken);

      expect(result.accessToken).toBe(mockNewAccessToken);
      expect(mockSetCredentials).toHaveBeenCalledWith({
        refresh_token: mockRefreshToken,
      });
      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });

    it('should throw error when refresh fails', async () => {
      const mockRefreshToken = 'invalid-refresh-token';

      mockRefreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(refreshAccessToken(mockRefreshToken)).rejects.toThrow('Failed to refresh Google access token');
    });

    it('should throw error when no access_token in response', async () => {
      const mockRefreshToken = 'mock-refresh-token';

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          // No access_token
        },
      });

      await expect(refreshAccessToken(mockRefreshToken)).rejects.toThrow('Failed to refresh Google access token');
    });
  });
});
