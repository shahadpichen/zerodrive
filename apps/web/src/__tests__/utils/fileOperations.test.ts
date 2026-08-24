import {
  deleteAllAndSyncFiles,
  deleteAndSyncFile,
} from "../../utils/fileOperations";
import {
  clearUserFilesFromDB,
  deleteFileFromDB,
  getAllFilesForUser,
  getFoldersForUser,
  sendToGoogleDrive,
} from "../../utils/dexieDB";
import {
  ensureGoogleDriveConnected,
  googleDriveFetch,
} from "../../utils/googleDriveRequest";
import { toast } from "sonner";
import {
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
} from "../../utils/mnemonicManager";

jest.mock("../../utils/dexieDB", () => ({
  clearUserFilesFromDB: jest.fn(),
  deleteFileFromDB: jest.fn(),
  getAllFilesForUser: jest.fn(),
  getFoldersForUser: jest.fn(),
  sendToGoogleDrive: jest.fn(),
}));

jest.mock("../../utils/googleDriveRequest", () => ({
  ensureGoogleDriveConnected: jest.fn(),
  googleDriveFetch: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  captureActiveRecoveryPhraseSession: jest.fn(() => ({
    phrase:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    generation: 1,
  })),
  assertRecoveryPhraseSessionCurrent: jest.fn(),
}));

jest.mock("../../utils/vaultMetadataWriteGuard", () => ({
  assertCanWriteVaultMetadata: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn() },
}));

jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(() => "toast-id"),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockGoogleDriveFetch = googleDriveFetch as jest.MockedFunction<
  typeof googleDriveFetch
>;

describe("file deletion operations", () => {
  const userEmail = "owner@example.com";

  beforeEach(() => {
    jest.clearAllMocks();
    (captureActiveRecoveryPhraseSession as jest.Mock).mockReturnValue({
      phrase:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      generation: 1,
    });
    (assertRecoveryPhraseSessionCurrent as jest.Mock).mockImplementation(
      () => undefined,
    );
    (toast.loading as jest.Mock).mockReturnValue("toast-id");
    mockGetAllFilesForUser.mockResolvedValue([]);
    mockGetFoldersForUser.mockResolvedValue([]);
    mockGoogleDriveFetch.mockResolvedValue(new Response(null, { status: 204 }));
    (ensureGoogleDriveConnected as jest.Mock).mockResolvedValue(undefined);
    (sendToGoogleDrive as jest.Mock).mockResolvedValue(undefined);
  });

  it("deletes one Drive object, local record, and commits the vault index", async () => {
    (deleteFileFromDB as jest.Mock).mockResolvedValue(1);

    await expect(
      deleteAndSyncFile("drive-file", "notes.txt", userEmail),
    ).resolves.toBe(true);

    expect(mockGoogleDriveFetch).toHaveBeenCalledWith(
      expect.stringContaining("drive-file"),
      { method: "DELETE" },
    );
    expect(deleteFileFromDB).toHaveBeenCalledWith("drive-file");
    expect(sendToGoogleDrive).toHaveBeenCalledWith([], [], {
      userEmail,
      recoveryPhraseSession: expect.objectContaining({ generation: 1 }),
    });
  });

  it("treats a missing Drive object as an already completed deletion", async () => {
    mockGoogleDriveFetch.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      deleteAndSyncFile("missing-file", "notes.txt", userEmail),
    ).resolves.toBe(true);
    expect(deleteFileFromDB).toHaveBeenCalledWith("missing-file");
  });

  it("deletes every known file and writes an empty vault index", async () => {
    mockGetAllFilesForUser.mockResolvedValue([
      {
        id: "file-1",
        name: "one.txt",
        mimeType: "text/plain",
        userEmail,
        uploadedDate: new Date(),
        folderId: null,
      },
      {
        id: "file-2",
        name: "two.txt",
        mimeType: "text/plain",
        userEmail,
        uploadedDate: new Date(),
        folderId: null,
      },
    ]);

    await expect(deleteAllAndSyncFiles(userEmail)).resolves.toBe(true);
    expect(mockGoogleDriveFetch).toHaveBeenCalledTimes(2);
    expect(clearUserFilesFromDB).toHaveBeenCalledWith(userEmail);
    expect(sendToGoogleDrive).toHaveBeenCalledWith([], [], {
      userEmail,
      recoveryPhraseSession: expect.objectContaining({ generation: 1 }),
    });
  });

  it("keeps an empty vault unchanged", async () => {
    await expect(deleteAllAndSyncFiles(userEmail)).resolves.toBe(true);
    expect(mockGoogleDriveFetch).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("No files found to delete.", {
      duration: 4000,
      id: "storage:delete-all",
    });
  });
});
