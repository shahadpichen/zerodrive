/**
 * Unit Tests for API Client
 * Tests HTTP client, API methods, error handling, and token refresh
 */

import apiClient, {
  publicKeysApi,
  sharedFilesApi,
  invitationsApi,
  healthApi,
  ApiError,
  NetworkError,
  TimeoutError,
} from "../../utils/apiClient";

// Mock dependencies
jest.mock("../../utils/authService");
jest.mock("../../utils/logger");

global.fetch = jest.fn();

const mockGetCsrfToken = jest.fn();
const mockRefreshToken = jest.fn();
const mockAuthLogout = jest.fn();

jest.mock("../../utils/authService", () => ({
  getCsrfToken: (...args: any[]) => mockGetCsrfToken(...args),
  refreshToken: (...args: any[]) => mockRefreshToken(...args),
  logout: (...args: any[]) => mockAuthLogout(...args),
}));

describe("ApiClient", () => {
  const mockCsrfToken = "mock-csrf-token";
  const testUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCsrfToken.mockReturnValue(mockCsrfToken);
    mockRefreshToken.mockResolvedValue(false);
    (global.fetch as jest.Mock).mockClear();
    delete (window as any).location;
    (window as any).location = { href: "" };
  });

  describe("Custom Error Classes", () => {
    it("should create ApiError with correct properties", () => {
      const error = new ApiError("Test error", "TEST_CODE", 400);

      expect(error.name).toBe("ApiError");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(400);
      expect(error instanceof Error).toBe(true);
    });

    it("should create ApiError with default values", () => {
      const error = new ApiError("Test error");

      expect(error.code).toBe("API_ERROR");
      expect(error.statusCode).toBe(500);
    });

    it("should create NetworkError", () => {
      const error = new NetworkError("Connection failed");

      expect(error.name).toBe("NetworkError");
      expect(error.message).toBe("Connection failed");
      expect(error instanceof Error).toBe(true);
    });

    it("should create NetworkError with default message", () => {
      const error = new NetworkError();

      expect(error.message).toBe("Network request failed");
    });

    it("should create TimeoutError", () => {
      const error = new TimeoutError("Timeout occurred");

      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("Timeout occurred");
    });

    it("should create TimeoutError with default message", () => {
      const error = new TimeoutError();

      expect(error.message).toBe("Request timeout");
    });
  });

  describe("HTTP Client - GET", () => {
    it("should make successful GET request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { test: "value" } }),
      });

      const response = await apiClient.get("/test");

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ test: "value" });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        }),
      );
    });

    it("should include query parameters in GET request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test", { param1: "value1", param2: 123 });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain("param1=value1");
      expect(fetchCall[0]).toContain("param2=123");
    });

    it("should skip undefined and null query parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test", {
        param1: "value1",
        param2: undefined,
        param3: null,
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain("param1=value1");
      expect(fetchCall[0]).not.toContain("param2");
      expect(fetchCall[0]).not.toContain("param3");
    });

    it("should not include CSRF token in GET requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers["X-CSRF-Token"]).toBeUndefined();
    });
  });

  describe("HTTP Client - POST", () => {
    it("should make successful POST request with data", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { id: 123 } }),
      });

      const postData = { name: "test", value: 42 };
      const response = await apiClient.post("/test", postData);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 123 });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      expect(fetchCall[1].body).toBe(JSON.stringify(postData));
    });

    it("should include CSRF token in POST requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.post("/test", {});

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers["X-CSRF-Token"]).toBe(mockCsrfToken);
    });

    it("should handle POST request without body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.post("/test");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].body).toBeUndefined();
    });
  });

  describe("HTTP Client - PUT", () => {
    it("should make successful PUT request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { updated: true } }),
      });

      const response = await apiClient.put("/test/123", { name: "updated" });

      expect(response.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test/123"),
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });

    it("should include CSRF token in PUT requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.put("/test", {});

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers["X-CSRF-Token"]).toBe(mockCsrfToken);
    });
  });

  describe("HTTP Client - DELETE", () => {
    it("should make successful DELETE request", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { deleted: true } }),
      });

      const response = await apiClient.delete("/test/123");

      expect(response.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test/123"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should include CSRF token in DELETE requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.delete("/test");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers["X-CSRF-Token"]).toBe(mockCsrfToken);
    });
  });

  describe("Error Handling", () => {
    it("should throw ApiError on HTTP error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "BAD_REQUEST", message: "Invalid input" },
        }),
      });

      await expect(apiClient.get("/test")).rejects.toThrow(ApiError);
      await expect(apiClient.get("/test")).rejects.toThrow("Invalid input");
    });

    it("should handle 401 and attempt token refresh", async () => {
      // First request fails with 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Token expired" },
        }),
      });

      // Refresh succeeds
      mockRefreshToken.mockResolvedValue(true);

      // Retry request succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      const response = await apiClient.get("/test");

      expect(response.success).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should not refresh or replay a rejected OAuth exchange", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired exchange code",
          },
        }),
      });

      await expect(
        apiClient.post("/auth/exchange", { code: "used-code" }),
      ).rejects.toThrow("Invalid or expired exchange code");

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockAuthLogout).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry a rejected authenticated request only once", async () => {
      const unauthorizedResponse = () => ({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not permitted" },
        }),
      });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce(unauthorizedResponse());
      mockRefreshToken.mockResolvedValue(true);

      await expect(apiClient.get("/test")).rejects.toThrow("Not permitted");

      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should logout and redirect when token refresh fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Token expired" },
        }),
      });

      mockRefreshToken.mockResolvedValue(false);

      await expect(apiClient.get("/test")).rejects.toThrow("Session expired");

      expect(mockAuthLogout).toHaveBeenCalled();
      expect(window.location.href).toBe("/");
    });

    it("should handle non-JSON response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "<html>Error page</html>",
      });

      const response = await apiClient.get("/test");

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("INVALID_RESPONSE");
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError("Failed to fetch"),
      );

      await expect(apiClient.get("/test")).rejects.toThrow(NetworkError);
    });

    it("should handle timeout errors", async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 60000);
          }),
      );

      const requestPromise = apiClient.get("/test");

      jest.advanceTimersByTime(30000);

      await expect(requestPromise).rejects.toThrow(TimeoutError);

      jest.useRealTimers();
    });

    it("should handle API success:false response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Validation failed" },
        }),
      });

      await expect(apiClient.get("/test")).rejects.toThrow(ApiError);
      await expect(apiClient.get("/test")).rejects.toThrow("Validation failed");
    });
  });

  describe("Public Keys API", () => {
    it("should upsert public key successfully", async () => {
      const publicKey = "test-public-key";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: "123", user_id: testUserId, public_key: publicKey },
        }),
      });

      const result = await publicKeysApi.upsert(publicKey);

      expect(result.user_id).toBe(testUserId);
      expect(result.public_key).toBe(publicKey);
    });

    it("should get public key successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { public_key: "test-key" },
        }),
      });

      const result = await publicKeysApi.lookup("recipient@example.com");

      expect(result).toEqual({ public_key: "test-key" });
    });

    it("should return null when public key not found", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "Public key not found" },
        }),
      });

      const result = await publicKeysApi.lookup("recipient@example.com");

      expect(result).toBeNull();
    });

    it("should delete public key successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
      });

      await expect(publicKeysApi.delete()).resolves.not.toThrow();
    });
  });

  describe("Shared Files API", () => {
    const shareData = {
      management_capability_hash: "a".repeat(64),
      recipient_email: "recipient@example.com",
      encrypted_file_key: "encrypted-key",
      encrypted_metadata: "encrypted-metadata",
      file_size: 1024,
      encrypted_size: 1052,
    };

    it("should create shared file successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: "share-123", ...shareData },
        }),
      });

      const result = await sharedFilesApi.create(shareData);

      expect(result.id).toBe("share-123");
      expect(result.file_id).toBeUndefined();
    });

    it("should get shared files for user", async () => {
      const files = [
        { id: "share-1", file_name: "file1.txt" },
        { id: "share-2", file_name: "file2.txt" },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { files, total: 2, hasMore: false },
        }),
      });

      const result = await sharedFilesApi.getForUser();

      expect(result.files).toEqual(files);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining("recipient_user_id"),
        expect.any(Object),
      );
    });

    it("should get shared file by ID", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: "share-123", file_name: "test.txt" },
        }),
      });

      const result = sharedFilesApi.getById("share-123");

      expect(result).toEqual({ id: "share-123", file_name: "test.txt" });
    });

    it("should return null when shared file not found", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "Not found" },
        }),
      });

      const result = sharedFilesApi.getById("nonexistent");

      expect(result).toBeNull();
    });

    it("should update shared file permissions", async () => {
      const updateData = { access_type: "download" as const };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { id: "share-123", access_type: "download" },
        }),
      });

      const result = await sharedFilesApi.update(
        "share-123",
        updateData,
        "management-capability",
      );

      expect(result.access_type).toBe("download");
    });

    it("should delete shared file", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { deleted: true } }),
      });

      const result = await sharedFilesApi.delete(
        "share-123",
        "management-capability",
      );

      expect(result.deleted).toBe(true);
    });

    it("should record file access", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: { recorded: true } }),
      });

      const result = await sharedFilesApi.recordAccess("share-123");

      expect(result.recorded).toBe(true);
    });
  });

  describe("Invitations API", () => {
    it("should send invitation successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { sent: true, remaining: 9, resetTime: Date.now() },
        }),
      });

      const result = await invitationsApi.send({
        recipient_email: "test@example.com",
      });

      expect(result.sent).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("should check rate limit status", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { remaining: 10, resetTime: null, canSend: true },
        }),
      });

      const result = await invitationsApi.checkRateLimit("test@example.com");

      expect(result.canSend).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should encode email in rate limit URL", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { remaining: 10, resetTime: null, canSend: true },
        }),
      });

      await invitationsApi.checkRateLimit("test+special@example.com");

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain(
        encodeURIComponent("test+special@example.com"),
      );
    });
  });

  describe("Health API", () => {
    it("should check API health", async () => {
      const healthData = {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: healthData }),
      });

      const result = await healthApi.check();

      expect(result.status).toBe("ok");
      expect(result.version).toBe("1.0.0");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty response body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
      });

      const response = await apiClient.get("/test");

      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
    });

    it("should handle CSRF token not available", async () => {
      mockGetCsrfToken.mockReturnValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.post("/test", {});

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers["X-CSRF-Token"]).toBeUndefined();
    });

    it("should handle very large response", async () => {
      const largeData = { items: new Array(10000).fill({ data: "test" }) };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: largeData }),
      });

      const response = await apiClient.get<{ items: any[] }>("/test");

      expect(response.data?.items.length).toBe(10000);
    });

    it("should handle special characters in endpoint", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      await apiClient.get("/test/special%20chars");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle concurrent requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, data: {} }),
      });

      const results = await Promise.all([
        apiClient.get("/test1"),
        apiClient.get("/test2"),
        apiClient.get("/test3"),
      ]);

      expect(results.every((r) => r.success)).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should rethrow non-401 errors without refresh attempt", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        }),
      });

      await expect(apiClient.get("/test")).rejects.toThrow("Access denied");
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });

    it("should handle malformed JSON response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(apiClient.get("/test")).rejects.toThrow();
    });
  });
});
