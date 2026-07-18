import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SharedWithMePage from "../../pages/shared-with-me";
import { getUserEmail } from "../../utils/authService";
import apiClient from "../../utils/apiClient";
import {
  decryptSharedFile,
  downloadEncryptedFile,
} from "../../utils/fileSharing";
import { getStoredKey } from "../../utils/cryptoUtils";
import { getUserKeyPair, userHasStoredKeys } from "../../utils/keyStorage";
import { uploadAndSyncFile } from "../../utils/fileOperations";
import { getMnemonic, setMnemonic } from "../../utils/mnemonicManager";
import { downloadEncryptedRsaKeyFromDrive } from "../../utils/gdriveKeyStorage";
import { decryptRsaPrivateKeyWithAesKey } from "../../utils/rsaKeyManager";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/authService", () => ({
  getUserEmail: jest.fn(),
}));

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  default: {
    sharedFiles: {
      getForUser: jest.fn(),
      recordAccess: jest.fn(),
    },
  },
}));

jest.mock("../../utils/fileSharing", () => ({
  arrayBufferToBase64: jest.fn(() => "base64-key"),
  decryptSharedFile: jest.fn(),
  downloadEncryptedFile: jest.fn(),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
}));

jest.mock("../../utils/keyStorage", () => ({
  getUserKeyPair: jest.fn(),
  userHasStoredKeys: jest.fn(),
}));

jest.mock("../../utils/fileOperations", () => ({
  uploadAndSyncFile: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn(),
  setMnemonic: jest.fn(),
}));

jest.mock("../../utils/gdriveKeyStorage", () => ({
  downloadEncryptedRsaKeyFromDrive: jest.fn(),
}));

jest.mock("../../utils/rsaKeyManager", () => ({
  decryptRsaPrivateKeyWithAesKey: jest.fn(),
}));

jest.mock("../../utils/analyticsTracker", () => ({
  trackEvent: jest.fn().mockResolvedValue(undefined),
  AnalyticsEvent: { SHARED_FILE_ACCESSED: "shared_file_accessed" },
  AnalyticsCategory: { SHARING: "sharing" },
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const mockGetUserEmail = getUserEmail as jest.MockedFunction<
  typeof getUserEmail
>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;
const mockGetMnemonic = getMnemonic as jest.MockedFunction<typeof getMnemonic>;
const mockSetMnemonic = setMnemonic as jest.MockedFunction<typeof setMnemonic>;
const mockGetUserKeyPair = getUserKeyPair as jest.MockedFunction<
  typeof getUserKeyPair
>;
const mockUserHasStoredKeys = userHasStoredKeys as jest.MockedFunction<
  typeof userHasStoredKeys
>;
const mockDownloadKeyBackup =
  downloadEncryptedRsaKeyFromDrive as jest.MockedFunction<
    typeof downloadEncryptedRsaKeyFromDrive
  >;
const mockDecryptKeyBackup =
  decryptRsaPrivateKeyWithAesKey as jest.MockedFunction<
    typeof decryptRsaPrivateKeyWithAesKey
  >;
const mockDownloadEncryptedFile = downloadEncryptedFile as jest.MockedFunction<
  typeof downloadEncryptedFile
>;
const mockDecryptSharedFile = decryptSharedFile as jest.MockedFunction<
  typeof decryptSharedFile
>;
const mockUploadAndSyncFile = uploadAndSyncFile as jest.MockedFunction<
  typeof uploadAndSyncFile
>;

const databaseFile = {
  id: "share-123",
  file_id: "shared/storage-key",
  file_name: "project-brief.pdf",
  created_at: "2026-07-01T10:30:00.000Z",
  expires_at: "2026-07-08T10:30:00.000Z",
  encrypted_file_key: "wrapped-key",
  file_size: 102400,
  mime_type: "application/pdf",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SharedWithMePage />
    </MemoryRouter>,
  );
}

function showFiles(files = [databaseFile]) {
  (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
    files,
    total: files.length,
    hasMore: false,
  });
}

describe("SharedWithMePage", () => {
  beforeAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: jest.fn(() => "blob:download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserEmail.mockResolvedValue("recipient@example.com");
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);
    mockDownloadKeyBackup.mockResolvedValue(new Blob(["encrypted key"]));
    mockDecryptKeyBackup.mockResolvedValue({
      kty: "RSA",
      d: "private",
    });
    mockUserHasStoredKeys.mockResolvedValue(true);
    mockGetMnemonic.mockReturnValue("valid recovery phrase");
    mockGetUserKeyPair.mockResolvedValue({
      publicKeyJwk: { kty: "RSA" },
      privateKeyJwk: { kty: "RSA", d: "private" },
    });
    mockDownloadEncryptedFile.mockResolvedValue(
      new Blob(["ciphertext"], { type: "application/octet-stream" }),
    );
    mockDecryptSharedFile.mockResolvedValue({
      decryptedFile: new Blob(["plaintext"], { type: "application/pdf" }),
      fileName: "project-brief.pdf",
    });
    mockUploadAndSyncFile.mockResolvedValue({
      id: "drive-copy",
      name: "project-brief.pdf",
      mimeType: "application/pdf",
      userEmail: "recipient@example.com",
      uploadedDate: new Date(),
      folderId: null,
    });
    (apiClient.sharedFiles.recordAccess as jest.Mock).mockResolvedValue({
      recorded: true,
    });
    showFiles([]);
  });

  it("renders a focused empty inbox", async () => {
    renderPage();

    expect(await screen.findByText("Your inbox is empty")).toBeInTheDocument();
    expect(screen.getByText("Shared with me")).toBeInTheDocument();
    expect(
      screen.getByText(/files shared with this account/i),
    ).toBeInTheDocument();
  });

  it("shows primary-key recovery as a clear prerequisite", async () => {
    mockGetStoredKey.mockResolvedValue(null);
    renderPage();

    expect(
      await screen.findByText("Recover your encryption key"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /open recovery & access/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/recovery-access?returnTo=%2Fshared-with-me",
    );
  });

  it("directs users to sharing setup when recipient keys are missing", async () => {
    mockDownloadKeyBackup.mockRejectedValue(new Error("Backup not found"));
    mockUserHasStoredKeys.mockResolvedValue(false);
    mockGetMnemonic.mockReturnValue(null);
    renderPage();

    expect(
      await screen.findByText("Enable encrypted sharing"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enable sharing/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/share");
  });

  it("uses the active AES key to unlock the sharing-key backup", async () => {
    mockGetMnemonic.mockReturnValue(null);
    showFiles();
    renderPage();

    expect(await screen.findByText("project-brief.pdf")).toBeInTheDocument();
    expect(mockDownloadKeyBackup).toHaveBeenCalled();
    expect(mockDecryptKeyBackup).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.any(Object),
    );
    expect(
      screen.queryByText("Unlock your sharing key"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeEnabled();
  });

  it("distinguishes an active file key from a locked sharing key", async () => {
    mockDownloadKeyBackup.mockRejectedValue(new Error("Legacy local key"));
    mockGetMnemonic.mockReturnValue(null);
    showFiles();
    renderPage();

    expect(
      await screen.findByText("Unlock your sharing key"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/file encryption key is active/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Recovery phrase for sharing key"), {
      target: { value: "valid recovery phrase" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /unlock sharing key/i }),
    );

    await waitFor(() =>
      expect(mockSetMnemonic).toHaveBeenCalledWith("valid recovery phrase"),
    );
    expect(
      screen.queryByText("Unlock your sharing key"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeEnabled();
  });

  it("renders current backend metadata and separates file actions", async () => {
    showFiles();
    renderPage();

    expect(await screen.findByText("project-brief.pdf")).toBeInTheDocument();
    expect(screen.getByText(/100\.0 KB/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^download$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save to storage/i }),
    ).toBeInTheDocument();
  });

  it("filters the inbox by filename", async () => {
    showFiles([
      databaseFile,
      {
        ...databaseFile,
        id: "share-456",
        file_id: "shared/other-key",
        file_name: "team-photo.png",
        mime_type: "image/png",
      },
    ]);
    renderPage();
    await screen.findByText("project-brief.pdf");

    fireEvent.change(screen.getByLabelText("Search shared files"), {
      target: { value: "photo" },
    });

    expect(screen.getByText("team-photo.png")).toBeInTheDocument();
    expect(screen.queryByText("project-brief.pdf")).not.toBeInTheDocument();
  });

  it("downloads without silently saving a vault copy", async () => {
    showFiles();
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /^download$/i }));

    await waitFor(() => expect(mockDecryptSharedFile).toHaveBeenCalled());
    expect(anchorClick).toHaveBeenCalled();
    expect(mockUploadAndSyncFile).not.toHaveBeenCalled();
    anchorClick.mockRestore();
  });

  it("saves an explicit encrypted copy to My Storage", async () => {
    showFiles();
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /save to storage/i }),
    );

    expect(
      await screen.findByRole("button", { name: /saved to storage/i }),
    ).toBeDisabled();
    expect(mockUploadAndSyncFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "project-brief.pdf",
        type: "application/pdf",
      }),
      "recipient@example.com",
    );
    expect(apiClient.sharedFiles.recordAccess).toHaveBeenCalledWith(
      "share-123",
    );
  });

  it("shows a recoverable inline error when the inbox fails", async () => {
    (apiClient.sharedFiles.getForUser as jest.Mock).mockRejectedValue(
      new Error("Network unavailable"),
    );
    renderPage();

    expect(await screen.findByText("Inbox unavailable")).toBeInTheDocument();
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("refreshes the inbox without replacing it with toast-only feedback", async () => {
    renderPage();
    await screen.findByText("Your inbox is empty");

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() =>
      expect(apiClient.sharedFiles.getForUser).toHaveBeenCalledTimes(2),
    );
  });
});
