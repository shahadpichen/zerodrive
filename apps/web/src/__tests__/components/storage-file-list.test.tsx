import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileList } from "../../components/storage/file-list";
import { getAllFilesForUser, getFoldersForUser } from "../../utils/dexieDB";
import { decryptFile } from "../../utils/decryptFile";
import { googleDriveFetch } from "../../utils/googleDriveRequest";
import { getStoredKey } from "../../utils/cryptoUtils";
import { useFolderContext } from "../../components/storage/folder-context";
import { useOptionalVaultData } from "../../contexts/vault-data-context";
import { userNotifications } from "../../utils/userNotifications";

jest.mock("../../utils/dexieDB", () => ({
  deleteFileFromDB: jest.fn(),
  getAllFilesForUser: jest.fn(),
  getFilesInFolder: jest.fn(),
  getFoldersForUser: jest.fn(),
  sendToGoogleDrive: jest.fn(),
}));

jest.mock("../../components/storage/folder-context", () => ({
  useFolderContext: jest.fn(() => ({
    currentFolderId: null,
    currentPath: [],
    navigateToFolder: jest.fn(),
    setCurrentPath: jest.fn(),
  })),
}));

jest.mock("../../contexts/vault-data-context", () => ({
  useOptionalVaultData: jest.fn(),
}));

jest.mock("../../components/storage/file-preview-dialog", () => ({
  FilePreviewDialog: () => null,
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn().mockResolvedValue({ kty: "oct", k: "test-key" }),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  hasMnemonic: jest.fn(() => true),
  requireActiveRecoveryPhrase: jest.fn(() => "test recovery phrase"),
}));

jest.mock("../../utils/decryptFile", () => ({
  decryptFile: jest.fn(),
}));

jest.mock("../../utils/googleDriveRequest", () => ({
  googleDriveFetch: jest.fn(),
  readGoogleDriveError: jest.fn(),
}));

jest.mock("../../utils/userNotifications", () => ({
  userNotifications: {
    error: jest.fn(),
    errorFrom: jest.fn(),
    loading: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;
const mockDecryptFile = decryptFile as jest.MockedFunction<typeof decryptFile>;
const mockGoogleDriveFetch = googleDriveFetch as jest.MockedFunction<
  typeof googleDriveFetch
>;
const mockNotifications = userNotifications as unknown as {
  loading: jest.Mock;
  success: jest.Mock;
  dismiss: jest.Mock;
};
const mockUseFolderContext = useFolderContext as jest.MockedFunction<
  typeof useFolderContext
>;
const mockUseOptionalVaultData = useOptionalVaultData as jest.MockedFunction<
  typeof useOptionalVaultData
>;

describe("Storage FileList empty state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOptionalVaultData.mockReturnValue(null);
    mockUseFolderContext.mockReturnValue({
      currentFolderId: null,
      currentPath: [],
      navigateToFolder: jest.fn(),
      navigateUp: jest.fn(),
      goToRoot: jest.fn(),
      setCurrentPath: jest.fn(),
    });
    mockGetAllFilesForUser.mockResolvedValue([]);
    mockGetFoldersForUser.mockResolvedValue([]);
    mockGetStoredKey.mockResolvedValue({ kty: "oct", k: "test-key" } as any);
  });

  it("explains the encrypted vault and offers the first upload action", async () => {
    const onUploadClick = jest.fn();

    render(
      <FileList
        view="full"
        userEmail="owner@example.com"
        onUploadClick={onUploadClick}
      />,
    );

    expect(
      await screen.findByText("Your encrypted vault is empty."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/encrypted copy to your Google Drive/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search files…"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /upload first encrypted file/i }),
    );

    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });

  it("does not show the empty vault state while vault metadata is still being checked", async () => {
    render(
      <FileList
        view="full"
        userEmail="owner@example.com"
        isVaultMetadataLoading
      />,
    );

    expect(
      await screen.findByText("Checking encrypted vault..."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your encrypted vault is empty."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search files…"),
    ).not.toBeInTheDocument();
  });

  it("renders shared vault files on the first paint before IndexedDB resolves", () => {
    mockGetAllFilesForUser.mockReturnValue(new Promise(() => {}) as any);
    mockUseOptionalVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [
          {
            id: "cached-file-1",
            name: "cached-notes.pdf",
            mimeType: "application/pdf",
            userEmail: "owner@example.com",
            uploadedDate: new Date("2026-07-19T00:00:00.000Z"),
            folderId: null,
          },
        ],
        folders: [],
        isHydrating: false,
        isRefreshing: false,
        metadataStatus: "ready",
        hasVaultKey: true,
        lastSyncedAt: Date.now(),
        error: null,
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: jest.fn(),
      setVaultMetadataStatus: jest.fn(),
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });

    render(<FileList view="full" userEmail="owner@example.com" />);

    expect(screen.getByText("cached-notes.pdf")).toBeInTheDocument();
    expect(
      screen.queryByText("Checking encrypted vault..."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your encrypted vault is empty."),
    ).not.toBeInTheDocument();
  });

  it("guides locked empty vaults to recover access before uploading", async () => {
    const onUploadClick = jest.fn();
    const onRecoverAccessClick = jest.fn();

    render(
      <FileList
        view="full"
        userEmail="owner@example.com"
        hasVaultKey={false}
        onUploadClick={onUploadClick}
        onRecoverAccessClick={onRecoverAccessClick}
      />,
    );

    expect(
      await screen.findByText("Set up Recovery & Access first."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create a new recovery phrase/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload first encrypted file/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /create or recover access/i }),
    );

    expect(onRecoverAccessClick).toHaveBeenCalledTimes(1);
    expect(onUploadClick).not.toHaveBeenCalled();
  });

  it("uses one notification id from download through completion without a global dismiss", async () => {
    const encryptedFile = new File(["encrypted"], "opaque.zd");
    const decryptedFile = new File(["readable"], "archive.zip", {
      type: "application/zip",
    });
    mockGetAllFilesForUser.mockResolvedValue([
      {
        id: "file-download-1",
        name: "archive.zip",
        mimeType: "application/zip",
        userEmail: "owner@example.com",
        uploadedDate: new Date("2026-08-25T00:00:00.000Z"),
        folderId: null,
      },
    ]);
    mockGoogleDriveFetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(encryptedFile),
    } as unknown as Response);
    mockDecryptFile.mockResolvedValue({
      contentBlob: decryptedFile,
      fileName: "archive.zip",
      mimeType: "application/zip",
      contentFormat: "capsule_v1",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:download-test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<FileList view="recent" userEmail="owner@example.com" />);
    await userEvent.click(
      await screen.findByTitle("Download archive.zip"),
    );

    await waitFor(() =>
      expect(mockNotifications.loading).toHaveBeenCalledWith(
        "Downloading archive.zip…",
        expect.objectContaining({ id: "storage:download:file-download-1" }),
      ),
    );
    expect(mockNotifications.loading).toHaveBeenCalledWith(
      "Opening encrypted file…",
      expect.objectContaining({ id: "storage:download:file-download-1" }),
    );
    await waitFor(() =>
      expect(mockNotifications.success).toHaveBeenCalledWith(
        "File downloaded",
        expect.objectContaining({ id: "storage:download:file-download-1" }),
      ),
    );
    expect(mockNotifications.dismiss).not.toHaveBeenCalled();
  });
});
