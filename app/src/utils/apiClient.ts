/**
 * API Client for ZeroDrive Backend
 * Handles all backend API communication
 */

import { getCsrfToken, refreshToken, logout as authLogout } from './authService';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// API Response Types
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface PublicKeyData {
  id?: string;
  user_id: string;
  public_key: string;
  created_at?: string;
  updated_at?: string;
}

interface SharedFileData {
  id?: string;
  file_id: string;
  owner_user_id: string;
  recipient_user_id: string;
  encrypted_file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  access_type: 'view' | 'download';
  expires_at?: string;
  last_accessed_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Custom Error Classes
export class ApiError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'API_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// HTTP Client with timeout and error handling
class HttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add CSRF token for state-changing requests
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET')) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
        credentials: 'include', // Send cookies automatically
      });

      clearTimeout(timeoutId);

      // Parse response
      let responseData: ApiResponse<T>;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // Handle non-JSON responses
        const text = await response.text();
        responseData = {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: `Server returned non-JSON response: ${text}`
          }
        };
      }

      // Handle HTTP errors
      if (!response.ok) {
        // Handle 401 Unauthorized - try refresh, then logout if refresh fails
        if (response.status === 401) {
          console.warn('Unauthorized request, attempting token refresh...');

          // Try to refresh access token
          const refreshed = await refreshToken();

          if (refreshed) {
            // Token refreshed successfully, retry original request
            console.log('Token refreshed, retrying request...');
            clearTimeout(timeoutId);
            return this.request<T>(endpoint, options);
          }

          // Refresh failed, logout and redirect
          console.warn('Token refresh failed, logging out...');
          await authLogout();
          window.location.href = '/';
          throw new ApiError(
            'Session expired, please log in again',
            'UNAUTHORIZED',
            401
          );
        }

        throw new ApiError(
          responseData.error?.message || `HTTP ${response.status}`,
          responseData.error?.code || 'HTTP_ERROR',
          response.status
        );
      }

      // Handle API errors
      if (!responseData.success && responseData.error) {
        throw new ApiError(
          responseData.error.message,
          responseData.error.code,
          response.status
        );
      }

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request to ${endpoint} timed out after ${this.timeout}ms`);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(`Network error: ${error.message}`);
      }

      throw new NetworkError(`Request failed: ${error.message}`);
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }

    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create HTTP client instance
const httpClient = new HttpClient(API_BASE_URL);

// Public Keys API
export const publicKeysApi = {
  /**
   * Store or update a user's public key
   */
  async upsert(userId: string, publicKey: string): Promise<PublicKeyData> {
    const response = await httpClient.post<PublicKeyData>('/public-keys', {
      user_id: userId,
      public_key: publicKey,
    });

    return response.data!;
  },

  /**
   * Get a user's public key by user ID
   */
  async get(userId: string): Promise<{ public_key: string } | null> {
    try {
      const response = await httpClient.get<{ public_key: string }>(`/public-keys/${userId}`);
      return response.data!;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * List all public keys (for debugging)
   */
  async list(): Promise<PublicKeyData[]> {
    const response = await httpClient.get<PublicKeyData[]>('/public-keys');
    return response.data!;
  },

  /**
   * Delete a user's public key
   */
  async delete(userId: string): Promise<void> {
    await httpClient.delete(`/public-keys/${userId}`);
  },
};

// Shared Files API
export const sharedFilesApi = {
  /**
   * Create a new file share
   */
  async create(shareData: {
    file_id: string;
    owner_user_id: string;
    recipient_user_id: string;
    encrypted_file_key: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    access_type?: 'view' | 'download';
    expires_at?: string;
  }): Promise<SharedFileData> {
    const response = await httpClient.post<SharedFileData>('/shared-files', shareData);
    return response.data!;
  },

  /**
   * Get shared files for a user (as owner or recipient)
   */
  async getForUser(
    userId: string,
    options: {
      owner_user_id?: string;
      recipient_user_id?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ files: SharedFileData[]; total: number; hasMore: boolean }> {
    const params = {
      recipient_user_id: userId,
      ...options,
    };

    const response = await httpClient.get<{ files: SharedFileData[]; total: number; hasMore: boolean }>('/shared-files', params);
    return response.data!;
  },

  /**
   * Get a specific shared file by ID
   */
  async getById(id: string): Promise<SharedFileData | null> {
    try {
      const response = await httpClient.get<SharedFileData>(`/shared-files/${id}`);
      return response.data!;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Update shared file permissions
   */
  async update(id: string, updateData: {
    access_type?: 'view' | 'download';
    expires_at?: string | null;
  }): Promise<SharedFileData> {
    const response = await httpClient.put<SharedFileData>(`/shared-files/${id}`, updateData);
    return response.data!;
  },

  /**
   * Delete/revoke a shared file
   */
  async delete(id: string): Promise<{ deleted: boolean }> {
    const response = await httpClient.delete<{ deleted: boolean }>(`/shared-files/${id}`);
    return response.data!;
  },

  /**
   * Record file access
   */
  async recordAccess(id: string): Promise<{ recorded: boolean }> {
    const response = await httpClient.post<{ recorded: boolean }>(`/shared-files/${id}/access`);
    return response.data!;
  },
};

// Invitations API
export const invitationsApi = {
  /**
   * Send invitation email to unregistered user
   */
  async send(data: {
    recipient_email: string;
    sender_message?: string;
  }): Promise<{
    sent: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const response = await httpClient.post<{
      sent: boolean;
      remaining: number;
      resetTime: number;
    }>('/invitations/send', data);
    return response.data!;
  },

  /**
   * Check rate limit status for an email
   */
  async checkRateLimit(email: string): Promise<{
    remaining: number;
    resetTime: number | null;
    canSend: boolean;
  }> {
    const response = await httpClient.get<{
      remaining: number;
      resetTime: number | null;
      canSend: boolean;
    }>(`/invitations/rate-limit/${encodeURIComponent(email)}`);
    return response.data!;
  },
};

// Health Check API
export const healthApi = {
  /**
   * Check API health
   */
  async check(): Promise<{
    status: string;
    timestamp: string;
    version: string;
  }> {
    const response = await httpClient.get<{
      status: string;
      timestamp: string;
      version: string;
    }>('/health');
    return response.data!;
  },
};

// Default export for compatibility
const apiClient = {
  publicKeys: publicKeysApi,
  sharedFiles: sharedFilesApi,
  invitations: invitationsApi,
  health: healthApi,
  // Expose HTTP methods for custom endpoints (like pre-signed URLs)
  get: httpClient.get.bind(httpClient),
  post: httpClient.post.bind(httpClient),
  put: httpClient.put.bind(httpClient),
  delete: httpClient.delete.bind(httpClient),
};

export default apiClient;