/**
 * Unit Tests for Google Drive Key Storage
 * Tests RSA key backup/restore with error propagation
 */

import {
  uploadEncryptedRsaKeyToDrive,
  downloadEncryptedRsaKeyFromDrive,
} from "../../utils/gdriveKeyStorage";
import { getGoogleAccessToken } from "../../utils/gapiInit";

// Mock dependencies
jest.mock("../../utils/gapiInit");

// Mock fetch
global.fetch = jest.fn();

// Mock logger to avoid console spam
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("gdriveKeyStorage", () => {
  const mockAccessToken = "mock-access-token";
  const mockBlob = new Blob(["encrypted-key-data"], {
    type: "application/json",
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
  });

  const mockJsonResponse = (
    body: unknown,
    response: Partial<Response> = {},
  ) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    ...response,
  });

  const mockListResponse = (files: Array<{ id: string; name?: string }>) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockJsonResponse({ files }),
    );
  };

  describe("uploadEncryptedRsaKeyToDrive", () => {
    it("should throw error when no access token available", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow(
        "Google Drive is not connected",
      );
    });

    it("should throw error on 403 Forbidden response", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);

      // GoogleDriveFetch retries an auth failure once before surfacing it.
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Forbidden",
      });

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow();
    });

    it("should successfully upload and return file ID", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([]);

      const mockFileId = "mock-file-id-123";
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse({ id: mockFileId }),
      );

      const result = await uploadEncryptedRsaKeyToDrive(mockBlob);

      expect(result).toBe(mockFileId);
      const fetchCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(fetchCall[0]).toEqual(
        expect.stringContaining("googleapis.com/upload/drive/v3/files"),
      );
      expect(fetchCall[1].method).toBe("POST");
      expect(fetchCall[1].headers.get("Authorization")).toBe(
        `Bearer ${mockAccessToken}`,
      );
    });

    it("should update existing file instead of creating new one", async () => {
      const existingFileId = "existing-file-id";
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([{ id: existingFileId }]);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse({ id: existingFileId }),
      );

      const result = await uploadEncryptedRsaKeyToDrive(mockBlob);

      expect(result).toBe(existingFileId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`files/${existingFileId}`),
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });

    it("should propagate error with details when upload fails", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([]);

      const errorMessage = "Network error";
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow(
        errorMessage,
      );
    });

    it("refreshes an expired token while looking up an existing backup", async () => {
      (getGoogleAccessToken as jest.Mock)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("refreshed-token")
        .mockResolvedValueOnce("refreshed-token");
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce(mockJsonResponse({ files: [] }))
        .mockResolvedValueOnce(mockJsonResponse({ id: "new-backup-id" }));

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).resolves.toBe(
        "new-backup-id",
      );

      expect(getGoogleAccessToken).toHaveBeenNthCalledWith(2, {
        forceRefresh: true,
        minValidityMs: expect.any(Number),
      });
      const retryHeaders = (global.fetch as jest.Mock).mock.calls[1][1]
        .headers as Headers;
      expect(retryHeaders.get("Authorization")).toBe(
        "Bearer refreshed-token",
      );
    });
  });

  describe("downloadEncryptedRsaKeyFromDrive", () => {
    it("should throw error when no access token available", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        "Google Drive is not connected",
      );
    });

    it("should throw error when file not found in appDataFolder or root Drive", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([]);
      mockListResponse([]);

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        "not found in appDataFolder or root Google Drive",
      );
    });

    it("should successfully download and return Blob", async () => {
      const mockFileId = "mock-file-id";
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([
        { id: mockFileId, name: "zerodrive_rsa_key_backup.json" },
      ]);

      const mockDownloadedBlob = new Blob(["downloaded-key"], {
        type: "application/json",
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => mockDownloadedBlob,
      });

      const result = await downloadEncryptedRsaKeyFromDrive();

      expect(result).toBe(mockDownloadedBlob);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`files/${mockFileId}?alt=media`),
        expect.objectContaining({
          method: "GET",
          headers: expect.any(Headers),
        }),
      );
    });

    it("downloads the requested historical key version", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([{ id: "historical-key-id" }]);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => new Blob(["historical-key"]),
      });

      await downloadEncryptedRsaKeyFromDrive(3);

      const lookupUrl = new URL(
        (global.fetch as jest.Mock).mock.calls[0][0] as string,
      );
      expect(lookupUrl.searchParams.get("q")).toBe(
        "name='zerodrive_rsa_key_backup_v3.json' and trashed=false",
      );
      expect(lookupUrl.searchParams.get("spaces")).toBe("appDataFolder");
    });

    it("should throw error when download request fails", async () => {
      const mockFileId = "mock-file-id";
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([
        { id: mockFileId, name: "zerodrive_rsa_key_backup.json" },
      ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        "Failed to download key file from appDataFolder (hidden)",
      );
    });

    it("should propagate network errors", async () => {
      const mockFileId = "mock-file-id";
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      mockListResponse([{ id: mockFileId }]);

      const networkError = new Error("Network connection failed");
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        "Network connection failed",
      );
    });
  });

  describe("Error Propagation", () => {
    it("uploadEncryptedRsaKeyToDrive should never return null", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      // Should throw, not return null
      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow();
    });

    it("downloadEncryptedRsaKeyFromDrive should never return null", async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      // Should throw, not return null
      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow();
    });
  });
});
