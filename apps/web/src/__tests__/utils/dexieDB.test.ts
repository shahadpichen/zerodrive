/**
 * Unit Tests for DexieDB
 * Tests Google Drive metadata sync functionality
 *
 * Note: These tests focus on Google Drive sync and encryption logic
 * rather than Dexie CRUD operations which are library-specific.
 */

// Mock Dexie before any imports
import { toast } from "sonner";
import {
  sendToGoogleDrive,
  fetchAndStoreFileMetadata,
  FileMeta,
  FolderMeta,
  db,
} from "../../utils/dexieDB";
import { rememberVaultMetadataStatus } from "../../utils/vaultMetadataWriteGuard";
import { clearMnemonic, setMnemonic } from "../../utils/mnemonicManager";

jest.mock("dexie", () => {
  const mockTable = {
    add: jest.fn().mockResolvedValue(1),
    where: jest.fn().mockReturnValue({
      equals: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
        first: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(0),
      }),
    }),
    delete: jest.fn().mockResolvedValue(1),
    clear: jest.fn().mockResolvedValue(undefined),
    toArray: jest.fn().mockResolvedValue([]),
  };

  class MockDexie {
    files = mockTable;
    version() {
      return {
        stores: jest.fn().mockReturnValue({
          upgrade: jest.fn().mockReturnThis(),
        }),
      };
    }
    table(tableName: string) {
      return this.files;
    }
    static delete = jest.fn().mockResolvedValue(undefined);
  }

  return {
    __esModule: true,
    default: MockDexie,
  };
});

// Mock modules
jest.mock("../../utils/gapiInit");
jest.mock("../../utils/authService", () => ({
  GOOGLE_TOKEN_REFRESH_BUFFER_MS: 120000,
  clearGoogleTokens: jest.fn(),
  getOrFetchGoogleToken: (...args: any[]) =>
    mockGetOrFetchGoogleToken(...args),
}));
jest.mock("../../utils/metadataEncryption");
jest.mock("sonner");
jest.mock("../../utils/logger");
jest.mock("gapi-script", () => ({
  gapi: {
    load: jest.fn(),
    client: {
      init: jest.fn(),
      setToken: jest.fn(),
      request: jest.fn(),
    },
  },
  gapiComplete: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockGetOrFetchGoogleToken = jest.fn();

const mockEncryptMetadata = jest.fn();
const mockDecryptMetadata = jest.fn();
const mockDecryptMetadataWithRecoveryPhrase = jest.fn();
jest.mock("../../utils/metadataEncryption", () => ({
  encryptMetadata: (...args: any[]) => mockEncryptMetadata(...args),
  decryptMetadata: (...args: any[]) => mockDecryptMetadata(...args),
  decryptMetadataWithRecoveryPhrase: (...args: any[]) =>
    mockDecryptMetadataWithRecoveryPhrase(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(() => "toast-id"),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("DexieDB - Google Drive Sync", () => {
  const testUser = "test@example.com";
  const testFile: FileMeta = {
    id: "file-123",
    name: "test.txt",
    mimeType: "text/plain",
    userEmail: testUser,
    uploadedDate: new Date("2024-01-01"),
    folderId: null,
  };
  const testObjectId = "22222222-2222-4222-8222-222222222222";

  const expectHiddenVaultIndexSearch = (callIndex: number) => {
    const [url, options] = (global.fetch as jest.Mock).mock.calls[callIndex];
    const parsedUrl = new URL(url as string);

    expect(parsedUrl.searchParams.get("spaces")).toBe("appDataFolder");
    expect(parsedUrl.searchParams.get("q")).toContain(
      "zerodrive-vault-index.zd",
    );
    expect(options.method).toBe("GET");
  };

  const expectLegacyVaultIndexSearch = (callIndex: number) => {
    const [url, options] = (global.fetch as jest.Mock).mock.calls[callIndex];
    const parsedUrl = new URL(url as string);

    expect(parsedUrl.searchParams.get("spaces")).toBe("drive");
    expect(parsedUrl.searchParams.get("q")).toContain("db-list.json");
    expect(options.method).toBe("GET");
  };

  const readFormMetadata = async (form: FormData) => {
    const metadata = form.get("metadata");
    expect(metadata).toBeInstanceOf(Blob);
    return JSON.parse(await (metadata as Blob).text());
  };

  beforeEach(() => {
    sessionStorage.clear();
    setMnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );
    rememberVaultMetadataStatus(testUser, "ready");
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearMnemonic();
  });

  describe("sendToGoogleDrive", () => {
    beforeEach(() => {
      mockGetOrFetchGoogleToken.mockResolvedValue("mock-token");
      mockEncryptMetadata.mockResolvedValue(new Blob(["encrypted-data"]));
      (global.fetch as jest.Mock).mockClear();
    });

    it("should create a hidden appDataFolder vault index when none exists", async () => {
      const files: FileMeta[] = [
        {
          ...testFile,
          objectId: testObjectId,
          revision: 1,
        },
      ];
      const folders: FolderMeta[] = [
        {
          id: "folder-123",
          name: "Documents",
          parentId: null,
          userEmail: testUser,
          createdDate: new Date("2024-01-02T03:04:05.000Z"),
        },
      ];

      // Mock search response: no existing file
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock upload response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "new-file-id" }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "new-file-id", name: "zerodrive-vault-index.zd" }],
        }),
      });

      await sendToGoogleDrive(files, folders);

      expect(mockEncryptMetadata).toHaveBeenCalledWith(
        {
          version: 2,
          files: [
            {
              id: "file-123",
              objectId: testObjectId,
              revision: 1,
              name: "test.txt",
              mimeType: "text/plain",
              userEmail: testUser,
              uploadedDate: "2024-01-01T00:00:00.000Z",
              folderId: null,
            },
          ],
          folders: [
            {
              id: "folder-123",
              name: "Documents",
              parentId: null,
              userEmail: testUser,
              createdDate: "2024-01-02T03:04:05.000Z",
            },
          ],
        },
        expect.any(String),
      );
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expectHiddenVaultIndexSearch(0);

      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[0]).toContain("uploadType=multipart");
      expect(uploadCall[1].method).toBe("POST");
      const metadata = await readFormMetadata(uploadCall[1].body);
      expect(metadata).toEqual({
        name: "zerodrive-vault-index.zd",
        mimeType: "application/octet-stream",
        parents: ["appDataFolder"],
      });
    });

    it("rejects malformed Capsule file bindings instead of omitting them", async () => {
      const malformedFile = {
        ...testFile,
        objectId: "not-a-uuid",
        revision: 0,
      } as FileMeta;

      await expect(sendToGoogleDrive([malformedFile])).rejects.toThrow(
        "Vault metadata contains an invalid file identifier.",
      );
      expect(mockEncryptMetadata).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should update an existing hidden appDataFolder vault index", async () => {
      const files = [testFile];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: "existing-file-id" }] }),
      });

      // Mock update response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "existing-file-id" }),
      });

      await sendToGoogleDrive(files);

      expectHiddenVaultIndexSearch(0);
      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[0]).toContain("existing-file-id");
      expect(uploadCall[1].method).toBe("PATCH");
      await expect(readFormMetadata(uploadCall[1].body)).resolves.toEqual({});
    });

    it("cancels the Drive update if recovery access changes in flight", async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(async () => {
        setMnemonic(
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        );
        return {
          ok: true,
          json: async () => ({ files: [] }),
        };
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toMatchObject({
        name: "RecoveryPhraseChangedError",
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("does not report an in-flight Drive write as safe after recovery access changes", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockImplementationOnce(async () => {
        setMnemonic(
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        );
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: "new-file-id" }),
        };
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "new-file-id", name: "zerodrive-vault-index.zd" }],
        }),
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toMatchObject({
        name: "RecoveryPhraseChangedError",
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("cleans up and fails if a first hidden write races another tab", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "new-file-id" }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            { id: "new-file-id", name: "zerodrive-vault-index.zd" },
            { id: "other-tab-file-id", name: "zerodrive-vault-index.zd" },
          ],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow(
        "Another browser tab created the hidden vault index at the same time.",
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);
      expectHiddenVaultIndexSearch(0);
      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[1].method).toBe("POST");
      expectHiddenVaultIndexSearch(2);
      const deleteCall = (global.fetch as jest.Mock).mock.calls[3];
      expect(deleteCall[0]).toContain("/new-file-id");
      expect(deleteCall[1].method).toBe("DELETE");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("should throw error when no access token available", async () => {
      mockGetOrFetchGoogleToken.mockResolvedValue(null);

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow(
        "User not authenticated for Google Drive update.",
      );
    });

    it("should fail closed before syncing when metadata is not verified", async () => {
      sessionStorage.clear();

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow(
        /Refresh Storage before changing files or folders/,
      );
      expect(mockGetOrFetchGoogleToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should throw error when search request fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should throw error when upload fails", async () => {
      // Mock successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock failed upload
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Error details",
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow();
    });

    it("keeps successful background sync silent", async () => {
      // Mock successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock successful upload
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "file-id" }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "file-id", name: "zerodrive-vault-index.zd" }],
        }),
      });

      await sendToGoogleDrive([testFile]);

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("fetchAndStoreFileMetadata", () => {
    beforeEach(() => {
      mockGetOrFetchGoogleToken.mockResolvedValue("mock-token");
      mockEncryptMetadata.mockResolvedValue(new Blob(["migrated-index"]));
      mockDecryptMetadata.mockResolvedValue({
        version: 2,
        files: [
          {
            ...testFile,
            objectId: testObjectId,
            revision: 1,
            uploadedDate: testFile.uploadedDate.toISOString(),
          },
        ],
        folders: [],
      });
      mockDecryptMetadataWithRecoveryPhrase.mockResolvedValue({
        version: 2,
        files: [
          {
            ...testFile,
            objectId: testObjectId,
            revision: 1,
            uploadedDate: testFile.uploadedDate.toISOString(),
          },
        ],
        folders: [],
      });
      (global.fetch as jest.Mock).mockClear();
    });

    it("should fetch and decrypt metadata from hidden appDataFolder", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "hidden-index-id", name: "zerodrive-vault-index.zd" }],
        }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(mockDecryptMetadata).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectHiddenVaultIndexSearch(0);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
        "/hidden-index-id?alt=media",
      );
      expect(db.table("files").add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testFile.id,
          objectId: testObjectId,
          revision: 1,
          uploadedDate: testFile.uploadedDate,
        }),
      );
    });

    it("rejects verification results if recovery access changes in flight", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "hidden-index-id", name: "zerodrive-vault-index.zd" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["encrypted-metadata"]),
      });
      mockDecryptMetadata.mockImplementationOnce(async () => {
        setMnemonic(
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        );
        return {
          version: 2,
          files: [],
          folders: [],
        };
      });

      await expect(fetchAndStoreFileMetadata()).rejects.toMatchObject({
        name: "RecoveryPhraseChangedError",
      });
    });

    it("propagates a recovery access change from a token-refresh retry", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "hidden-index-id", name: "zerodrive-vault-index.zd" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["encrypted-metadata"]),
      });
      mockDecryptMetadata.mockImplementationOnce(async () => {
        setMnemonic(
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        );
        return {
          version: 2,
          files: [],
          folders: [],
        };
      });

      await expect(fetchAndStoreFileMetadata()).rejects.toMatchObject({
        name: "RecoveryPhraseChangedError",
      });
    });

    it("should handle case when no vault index exists", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
    });

    it("should throw a decryption error when metadata cannot be opened", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "hidden-index-id", name: "zerodrive-vault-index.zd" }],
        }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["encrypted"]),
      });

      mockDecryptMetadata.mockRejectedValue(new Error("Decryption failed"));

      await expect(fetchAndStoreFileMetadata()).rejects.toMatchObject({
        name: "DecryptionError",
        message: "DECRYPTION_FAILED",
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectHiddenVaultIndexSearch(0);
    });

    it("migrates a legacy visible db-list.json into hidden appDataFolder", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "hidden-index-id" }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "hidden-index-id",
              name: "zerodrive-vault-index.zd",
            },
          ],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["hidden-encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(7);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
      expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
        "/legacy-index-id?alt=media",
      );
      expectHiddenVaultIndexSearch(3);

      const uploadCall = (global.fetch as jest.Mock).mock.calls[4];
      expect(uploadCall[0]).toContain("uploadType=multipart");
      expect(uploadCall[1].method).toBe("POST");
      await expect(readFormMetadata(uploadCall[1].body)).resolves.toEqual({
        name: "zerodrive-vault-index.zd",
        mimeType: "application/octet-stream",
        parents: ["appDataFolder"],
      });
      expectHiddenVaultIndexSearch(5);
      expect((global.fetch as jest.Mock).mock.calls[6][0]).toContain(
        "/hidden-index-id?alt=media",
      );
      expect(mockEncryptMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2 }),
        expect.any(String),
      );
      expect(mockDecryptMetadataWithRecoveryPhrase).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.any(String),
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("loads a legacy visible db-list.json without migrating when only a legacy JSON key is active", async () => {
      clearMnemonic();
      mockEncryptMetadata.mockClear();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
      expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
        "/legacy-index-id?alt=media",
      );
      expect(mockDecryptMetadata).toHaveBeenCalled();
      expect(mockDecryptMetadataWithRecoveryPhrase).not.toHaveBeenCalled();
      expect(mockEncryptMetadata).not.toHaveBeenCalled();
      expect(db.table("files").add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testFile.id,
          objectId: testObjectId,
          revision: 1,
          uploadedDate: testFile.uploadedDate,
        }),
      );
      expect(toast.success).not.toHaveBeenCalledWith(
        "Vault index moved to hidden app storage.",
      );
    });

    it("loads a legacy visible db-list.json without migrating when the active phrase cannot open it", async () => {
      mockEncryptMetadata.mockClear();
      mockDecryptMetadataWithRecoveryPhrase.mockRejectedValueOnce(
        new Error("Wrong recovery phrase"),
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
      expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
        "/legacy-index-id?alt=media",
      );
      expect(mockDecryptMetadata).toHaveBeenCalled();
      expect(mockDecryptMetadataWithRecoveryPhrase).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.any(String),
      );
      expect(mockEncryptMetadata).not.toHaveBeenCalled();
      expect(db.table("files").add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testFile.id,
          objectId: testObjectId,
          revision: 1,
          uploadedDate: testFile.uploadedDate,
        }),
      );
      expect(toast.success).not.toHaveBeenCalledWith(
        "Vault index moved to hidden app storage.",
      );
    });

    it("rejects legacy migration if recovery access changes during phrase-only proof", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });
      mockDecryptMetadataWithRecoveryPhrase.mockImplementationOnce(async () => {
        setMnemonic(
          "legal winner thank year wave sausage worth useful legal winner thank yellow",
        );
        return {
          version: 2,
          files: [
            {
              ...testFile,
              objectId: testObjectId,
              revision: 1,
              uploadedDate: testFile.uploadedDate.toISOString(),
            },
          ],
          folders: [],
        };
      });

      await expect(fetchAndStoreFileMetadata()).rejects.toMatchObject({
        name: "RecoveryPhraseChangedError",
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockEncryptMetadata).not.toHaveBeenCalled();
      expect(db.table("files").clear).not.toHaveBeenCalled();
      expect(db.table("folders").clear).not.toHaveBeenCalled();
    });

    it("does not overwrite a hidden index that appears during legacy migration", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "hidden-race-index-id",
              name: "zerodrive-vault-index.zd",
            },
          ],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["hidden-encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(5);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
      expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
        "/legacy-index-id?alt=media",
      );
      expectHiddenVaultIndexSearch(3);
      expect((global.fetch as jest.Mock).mock.calls[4][0]).toContain(
        "/hidden-race-index-id?alt=media",
      );
      expect(
        (global.fetch as jest.Mock).mock.calls.some(
          ([url, options]) =>
            typeof url === "string" &&
            url.includes("upload/drive/v3/files") &&
            options?.method === "PATCH",
        ),
      ).toBe(false);
      expect(
        (global.fetch as jest.Mock).mock.calls.some(
          ([url, options]) =>
            typeof url === "string" &&
            url.includes("upload/drive/v3/files") &&
            options?.method === "POST",
        ),
      ).toBe(false);
      expect(toast.success).not.toHaveBeenCalledWith(
        "Vault index moved to hidden app storage.",
      );
    });

    it("cleans up a migration duplicate if a hidden index is created during upload", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "legacy-index-id", name: "db-list.json" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["legacy-encrypted-metadata"]),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "stale-migration-index-id" }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "stale-migration-index-id",
              name: "zerodrive-vault-index.zd",
            },
            {
              id: "newer-hidden-index-id",
              name: "zerodrive-vault-index.zd",
            },
          ],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["newer-hidden-encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(8);
      expectHiddenVaultIndexSearch(0);
      expectLegacyVaultIndexSearch(1);
      expectHiddenVaultIndexSearch(3);

      const uploadCall = (global.fetch as jest.Mock).mock.calls[4];
      expect(uploadCall[0]).toContain("uploadType=multipart");
      expect(uploadCall[1].method).toBe("POST");
      expectHiddenVaultIndexSearch(5);

      const deleteCall = (global.fetch as jest.Mock).mock.calls[6];
      expect(deleteCall[0]).toContain("/stale-migration-index-id");
      expect(deleteCall[1].method).toBe("DELETE");

      expect((global.fetch as jest.Mock).mock.calls[7][0]).toContain(
        "/newer-hidden-index-id?alt=media",
      );
      expect(toast.success).not.toHaveBeenCalledWith(
        "Vault index moved to hidden app storage.",
      );
    });

    it("fails closed when multiple hidden vault indexes already exist", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "hidden-index-id-1",
              name: "zerodrive-vault-index.zd",
            },
            {
              id: "hidden-index-id-2",
              name: "zerodrive-vault-index.zd",
            },
          ],
        }),
      });

      await expect(fetchAndStoreFileMetadata()).rejects.toThrow(
        "Multiple hidden vault indexes were found.",
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expectHiddenVaultIndexSearch(0);
      expect(mockDecryptMetadata).not.toHaveBeenCalled();
    });

    it("uses hidden appDataFolder when both hidden and legacy indexes exist", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: "hidden-index-id", name: "zerodrive-vault-index.zd" }],
        }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["encrypted-metadata"]),
      });

      await fetchAndStoreFileMetadata();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectHiddenVaultIndexSearch(0);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
        "/hidden-index-id?alt=media",
      );
      expect(mockEncryptMetadata).not.toHaveBeenCalled();
    });
  });
});
