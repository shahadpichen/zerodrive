/**
 * Unit Tests for Google API Initialization
 * Tests gapi initialization and token management
 */

// Mock modules at the very top with inline functions
jest.mock('gapi-script', () => ({
  gapi: {
    load: jest.fn((api: string, callback: () => void) => {
      callback();
    }),
    client: {
      init: jest.fn().mockResolvedValue(undefined),
      setToken: jest.fn(),
    },
  },
  gapiComplete: jest.fn(),
}));
jest.mock('../../utils/authService');
jest.mock('../../utils/logger');

const mockGetOrFetchGoogleToken = jest.fn();
jest.mock('../../utils/authService', () => ({
  getOrFetchGoogleToken: (...args: any[]) => mockGetOrFetchGoogleToken(...args),
}));

describe('GapiInit', () => {
  let initializeGapi: any;
  let getGoogleAccessToken: any;
  let refreshGapiToken: any;
  let gapi: any;
  const mockAccessToken = 'mock-google-access-token';

  beforeEach(() => {
    // Reset modules to get fresh module state
    jest.resetModules();

    // Re-import modules after reset
    gapi = require('gapi-script').gapi;
    const gapiInit = require('../../utils/gapiInit');
    initializeGapi = gapiInit.initializeGapi;
    getGoogleAccessToken = gapiInit.getGoogleAccessToken;
    refreshGapiToken = gapiInit.refreshGapiToken;

    // Clear mock call history
    (gapi.load as jest.Mock).mockClear();
    (gapi.client.init as jest.Mock).mockClear();
    (gapi.client.setToken as jest.Mock).mockClear();
    mockGetOrFetchGoogleToken.mockClear();

    // Ensure mock implementations are set
    (gapi.load as jest.Mock).mockImplementation((api: string, callback: () => void) => {
      callback();
    });
    (gapi.client.init as jest.Mock).mockResolvedValue(undefined);

    mockGetOrFetchGoogleToken.mockResolvedValue(mockAccessToken);
  });

  describe('initializeGapi', () => {
    it('should initialize gapi successfully', async () => {
      await initializeGapi();

      expect(gapi.load).toHaveBeenCalledWith('client', expect.any(Function));
      expect(gapi.client.init).toHaveBeenCalledWith({
        discoveryDocs: [
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        ],
      });
      expect(gapi.client.setToken).toHaveBeenCalledWith({
        access_token: mockAccessToken,
      });
      expect(mockGetOrFetchGoogleToken).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await initializeGapi();
      jest.clearAllMocks();

      await initializeGapi();

      // Should not call gapi methods again
      expect(gapi.load).not.toHaveBeenCalled();
      expect(gapi.client.init).not.toHaveBeenCalled();
    });

    it('should wait for in-progress initialization', async () => {
      // Start first initialization (don't await yet)
      const promise1 = initializeGapi();

      // Start second initialization while first is in progress
      const promise2 = initializeGapi();

      // Both should resolve to the same result
      await Promise.all([promise1, promise2]);

      // gapi.load should only be called once
      expect(gapi.load).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no access token available', async () => {
      mockGetOrFetchGoogleToken.mockResolvedValue(null);

      await expect(initializeGapi()).rejects.toThrow(
        'Failed to get Google access token from backend'
      );
    });

    it('should throw error when client initialization fails', async () => {
      (gapi.client.init as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(initializeGapi()).rejects.toThrow('Network error');
    });

    it('should reset initialization promise on error', async () => {
      mockGetOrFetchGoogleToken.mockResolvedValue(null);

      try {
        await initializeGapi();
      } catch (error) {
        // Expected
      }

      // Reset mock to return valid token
      mockGetOrFetchGoogleToken.mockResolvedValue(mockAccessToken);
      (gapi.client.init as jest.Mock).mockResolvedValue(undefined);

      // Should be able to retry initialization
      await initializeGapi();

      expect(gapi.client.setToken).toHaveBeenCalled();
    });
  });

  describe('getGoogleAccessToken', () => {
    it('should return access token after ensuring initialization', async () => {
      const token = await getGoogleAccessToken();

      expect(token).toBe(mockAccessToken);
      expect(mockGetOrFetchGoogleToken).toHaveBeenCalled();
      expect(gapi.client.setToken).toHaveBeenCalledWith({
        access_token: mockAccessToken,
      });
    });

    it('should initialize gapi if not already initialized', async () => {
      await getGoogleAccessToken();

      expect(gapi.load).toHaveBeenCalled();
      expect(gapi.client.init).toHaveBeenCalled();
    });

    it('should return null when token fetch fails', async () => {
      mockGetOrFetchGoogleToken.mockRejectedValue(new Error('Auth failed'));

      const token = await getGoogleAccessToken();

      expect(token).toBeNull();
    });

    it('should return null and not throw when initialization fails', async () => {
      (gapi.client.init as jest.Mock).mockRejectedValue(
        new Error('Init failed')
      );

      const token = await getGoogleAccessToken();

      expect(token).toBeNull();
    });

    it('should update client token even if already initialized', async () => {
      // First call
      await getGoogleAccessToken();
      jest.clearAllMocks();

      // Second call with new token
      const newToken = 'new-token-value';
      mockGetOrFetchGoogleToken.mockResolvedValue(newToken);

      const token = await getGoogleAccessToken();

      expect(token).toBe(newToken);
      expect(gapi.client.setToken).toHaveBeenCalledWith({
        access_token: newToken,
      });
    });
  });

  describe('refreshGapiToken', () => {
    it('should refresh token successfully', async () => {
      const newToken = 'refreshed-token';
      mockGetOrFetchGoogleToken.mockResolvedValue(newToken);

      await refreshGapiToken();

      expect(mockGetOrFetchGoogleToken).toHaveBeenCalled();
      expect(gapi.client.setToken).toHaveBeenCalledWith({
        access_token: newToken,
      });
    });

    it('should throw error when token refresh fails', async () => {
      mockGetOrFetchGoogleToken.mockResolvedValue(null);

      await expect(refreshGapiToken()).rejects.toThrow('Failed to refresh token');
    });

    it('should throw error when getOrFetchGoogleToken throws', async () => {
      mockGetOrFetchGoogleToken.mockRejectedValue(new Error('Network error'));

      await expect(refreshGapiToken()).rejects.toThrow('Network error');
    });
  });
});
