import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PrivateStorage from "../../pages/private-storage";
import { useApp } from "../../contexts/app-context";
import { getStoredKey } from "../../utils/cryptoUtils";
import {
  fetchAndStoreFileMetadata,
  getAllFilesForUser,
  getFilesInFolder,
  getFoldersForUser,
} from "../../utils/dexieDB";
import { uploadAndSyncFile } from "../../utils/fileOperations";
import { toast } from "sonner";
import { useVaultData } from "../../contexts/vault-data-context";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";

jest.mock("../../contexts/app-context", () => ({
  useApp: jest.fn(),
}));

jest.mock("../../contexts/vault-data-context", () => ({
  useVaultData: jest.fn(),
  useOptionalVaultData: jest.fn().mockReturnValue(null),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
}));

jest.mock("../../utils/dexieDB", () => ({
  fetchAndStoreFileMetadata: jest.fn(),
  getAllFilesForUser: jest.fn(),
  getFilesInFolder: jest.fn(),
  getFoldersForUser: jest.fn(),
}));

jest.mock("../../utils/fileOperations", () => ({
  uploadAndSyncFile: jest.fn(),
  deleteAllAndSyncFiles: jest.fn(),
}));

jest.mock("../../components/storage/file-preview-dialog", () => ({
  FilePreviewDialog: () => null,
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/authService", () => ({
  getUserEmail: jest.fn().mockResolvedValue("owner@example.com"),
  hasGoogleTokensInStorage: jest.fn().mockReturnValue(true),
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/gapiInit", () => ({
  initializeGapi: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/sessionManager", () => ({
  getSessionUser: jest.fn().mockReturnValue("owner@example.com"),
  setSessionUser: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(),
    success: jest.fn(),
  },
}));

const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;
const mockUseVaultData = useVaultData as jest.MockedFunction<
  typeof useVaultData
>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;
const mockFetchAndStoreFileMetadata =
  fetchAndStoreFileMetadata as jest.MockedFunction<
    typeof fetchAndStoreFileMetadata
  >;
const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFilesInFolder = getFilesInFolder as jest.MockedFunction<
  typeof getFilesInFolder
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockUploadAndSyncFile = uploadAndSyncFile as jest.MockedFunction<
  typeof uploadAndSyncFile
>;
const mockToastInfo = toast.info as jest.MockedFunction<typeof toast.info>;
const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>;
let mockSetDecryptionError: jest.Mock;
let mockRefreshVaultFromLocal: jest.Mock;
let mockSetVaultMetadataStatus: jest.Mock;

const typeConfirmationCode = () => {
  const confirmationCode = screen.getByText((content) =>
    /^[A-Z2-9]{6}$/.test(content),
  ).textContent!;

  fireEvent.change(screen.getByLabelText(/type this code to continue/i), {
    target: { value: confirmationCode },
  });
};

describe("PrivateStorage metadata replacement warning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setMnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );

    jest
      .spyOn(global.crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        const values = array as unknown as {
          length: number;
          [key: number]: number;
        };
        if (values?.length) {
          for (let index = 0; index < values.length; index += 1) {
            values[index] = index;
          }
        }
        return array;
      });

    mockSetDecryptionError = jest.fn();
    mockRefreshVaultFromLocal = jest.fn().mockResolvedValue({
      files: [],
      folders: [],
    });
    mockSetVaultMetadataStatus = jest.fn();
    mockUseVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [],
        folders: [],
        isHydrating: false,
        isRefreshing: false,
        metadataStatus: "decryption_error",
        hasVaultKey: true,
        lastSyncedAt: null,
        error: null,
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: mockRefreshVaultFromLocal,
      setVaultMetadataStatus: mockSetVaultMetadataStatus,
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });
    mockUseApp.mockReturnValue({
      userEmail: "owner@example.com",
      userName: "Owner",
      userImage: "",
      storageInfo: null,
      isLoadingStorage: false,
      hasDecryptionError: true,
      setDecryptionError: mockSetDecryptionError,
      refreshStorage: jest.fn().mockResolvedValue(undefined),
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setUserInfo: jest.fn(),
    });

    mockGetStoredKey.mockResolvedValue({} as CryptoKey);
    mockFetchAndStoreFileMetadata.mockRejectedValue(
      Object.assign(new Error("Cannot decrypt metadata"), {
        name: "DecryptionError",
      }),
    );
    mockGetAllFilesForUser.mockResolvedValue([]);
    mockGetFilesInFolder.mockResolvedValue([]);
    mockGetFoldersForUser.mockResolvedValue([]);
    mockUploadAndSyncFile.mockResolvedValue({
      id: "drive-file-1",
      name: "notes.pdf",
      mimeType: "application/pdf",
      userEmail: "owner@example.com",
      uploadedDate: new Date("2026-07-19T00:00:00.000Z"),
      folderId: null,
    });
  });

  afterEach(() => {
    clearMnemonic();
    jest.restoreAllMocks();
  });

  it("blocks replacing an unreadable vault index until the confirmation code is typed", async () => {
    const file = new File(["hello"], "notes.pdf", {
      type: "application/pdf",
    });

    render(
      <MemoryRouter>
        <PrivateStorage />
      </MemoryRouter>,
    );

    const dropHint = await screen.findByText(/drop files anywhere to upload/i);

    await waitFor(() => {
      expect(mockSetDecryptionError).toHaveBeenCalledWith(true);
    });

    fireEvent.drop(dropHint, {
      dataTransfer: {
        types: ["Files"],
        files: [file],
      },
    });

    expect(
      await screen.findByText(/existing vault index could not be opened/i),
    ).toBeInTheDocument();
    expect(mockUploadAndSyncFile).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole("button", {
      name: /start fresh and upload/i,
    });
    expect(confirmButton).toBeDisabled();

    typeConfirmationCode();

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockUploadAndSyncFile).toHaveBeenCalledWith(
        file,
        "owner@example.com",
        null,
        { allowMetadataReplacement: true },
      );
    });
  });

  it("blocks uploads while vault metadata verification is still pending", async () => {
    const neverResolves = new Promise<void>(() => {});
    mockFetchAndStoreFileMetadata.mockReturnValue(neverResolves);
    mockSetDecryptionError = jest.fn();
    mockUseApp.mockReturnValue({
      userEmail: "owner@example.com",
      userName: "Owner",
      userImage: "",
      storageInfo: null,
      isLoadingStorage: false,
      hasDecryptionError: false,
      setDecryptionError: mockSetDecryptionError,
      refreshStorage: jest.fn().mockResolvedValue(undefined),
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setUserInfo: jest.fn(),
    });
    mockUseVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [],
        folders: [],
        isHydrating: false,
        isRefreshing: true,
        metadataStatus: "verifying",
        hasVaultKey: true,
        lastSyncedAt: null,
        error: null,
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: mockRefreshVaultFromLocal,
      setVaultMetadataStatus: mockSetVaultMetadataStatus,
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });

    const file = new File(["hello"], "notes.pdf", {
      type: "application/pdf",
    });

    render(
      <MemoryRouter>
        <PrivateStorage />
      </MemoryRouter>,
    );

    await screen.findByText(/drop files anywhere to upload/i);

    fireEvent.drop(screen.getByText(/drop files anywhere to upload/i), {
      dataTransfer: {
        types: ["Files"],
        files: [file],
      },
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      "Checking vault metadata",
      expect.any(Object),
    );
    expect(
      screen.queryByText(/existing vault index could not be opened/i),
    ).not.toBeInTheDocument();
    expect(mockUploadAndSyncFile).not.toHaveBeenCalled();
  });

  it("blocks uploads when vault metadata verification reaches a terminal error", async () => {
    mockFetchAndStoreFileMetadata.mockRejectedValue(
      new Error("Drive unavailable"),
    );
    mockSetDecryptionError = jest.fn();
    mockUseApp.mockReturnValue({
      userEmail: "owner@example.com",
      userName: "Owner",
      userImage: "",
      storageInfo: null,
      isLoadingStorage: false,
      hasDecryptionError: false,
      setDecryptionError: mockSetDecryptionError,
      refreshStorage: jest.fn().mockResolvedValue(undefined),
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setUserInfo: jest.fn(),
    });
    mockUseVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [],
        folders: [],
        isHydrating: false,
        isRefreshing: false,
        metadataStatus: "error",
        hasVaultKey: true,
        lastSyncedAt: null,
        error: "Drive unavailable",
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: mockRefreshVaultFromLocal,
      setVaultMetadataStatus: mockSetVaultMetadataStatus,
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });

    const file = new File(["hello"], "notes.pdf", {
      type: "application/pdf",
    });

    render(
      <MemoryRouter>
        <PrivateStorage />
      </MemoryRouter>,
    );

    const dropHint = await screen.findByText(/drop files anywhere to upload/i);

    fireEvent.drop(dropHint, {
      dataTransfer: {
        types: ["Files"],
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Vault metadata could not be verified",
        expect.objectContaining({
          description: expect.stringContaining(
            "Refresh Storage before uploading",
          ),
        }),
      );
    });
    expect(mockUploadAndSyncFile).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalledWith(
      "Checking vault metadata",
      expect.any(Object),
    );
  });

  it("uses Home's verified shared vault state instead of checking Drive again", async () => {
    mockUseVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [],
        folders: [],
        isHydrating: false,
        isRefreshing: false,
        metadataStatus: "ready",
        hasVaultKey: true,
        lastSyncedAt: Date.now(),
        error: null,
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: mockRefreshVaultFromLocal,
      setVaultMetadataStatus: mockSetVaultMetadataStatus,
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });
    mockUseApp.mockReturnValue({
      userEmail: "owner@example.com",
      userName: "Owner",
      userImage: "",
      storageInfo: null,
      isLoadingStorage: false,
      hasDecryptionError: false,
      setDecryptionError: mockSetDecryptionError,
      refreshStorage: jest.fn().mockResolvedValue(undefined),
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setUserInfo: jest.fn(),
    });
    mockFetchAndStoreFileMetadata.mockResolvedValue(undefined);
    mockGetAllFilesForUser.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <PrivateStorage />
      </MemoryRouter>,
    );

    await screen.findByText("Your encrypted vault is empty.");

    expect(mockFetchAndStoreFileMetadata).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Checking encrypted vault..."),
    ).not.toBeInTheDocument();
  });

  it("marks vault metadata as error when refresh verification fails", async () => {
    mockUseVaultData.mockReturnValue({
      state: {
        userEmail: "owner@example.com",
        files: [],
        folders: [],
        isHydrating: false,
        isRefreshing: false,
        metadataStatus: "ready",
        hasVaultKey: true,
        lastSyncedAt: Date.now(),
        error: null,
      },
      replaceVaultData: jest.fn(),
      refreshVaultFromLocal: mockRefreshVaultFromLocal,
      setVaultMetadataStatus: mockSetVaultMetadataStatus,
      setVaultKeyStatus: jest.fn(),
      clearVaultData: jest.fn(),
    });
    mockUseApp.mockReturnValue({
      userEmail: "owner@example.com",
      userName: "Owner",
      userImage: "",
      storageInfo: null,
      isLoadingStorage: false,
      hasDecryptionError: false,
      setDecryptionError: mockSetDecryptionError,
      refreshStorage: jest.fn().mockResolvedValue(undefined),
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setUserInfo: jest.fn(),
    });
    mockFetchAndStoreFileMetadata.mockRejectedValue(
      new Error("Drive unavailable"),
    );

    render(
      <MemoryRouter>
        <PrivateStorage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mockSetVaultMetadataStatus).toHaveBeenCalledWith(
        "owner@example.com",
        "error",
        "Drive unavailable",
      );
    });
  });
});
