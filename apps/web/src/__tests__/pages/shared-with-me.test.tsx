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
import { getUserKeyPair, getUserKeyPairs } from "../../utils/keyStorage";
import { uploadAndSyncFile } from "../../utils/fileOperations";
import { getMnemonic } from "../../utils/mnemonicManager";
import { downloadEncryptedRsaKeyFromDrive } from "../../utils/gdriveKeyStorage";
import { fetchAndStoreFileMetadata } from "../../utils/dexieDB";
import { openSharingKeyBackupCapsule } from "../../utils/capsuleAdapter";

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
  decryptSharedFile: jest.fn(),
  downloadEncryptedFile: jest.fn(),
}));

jest.mock("../../utils/keyStorage", () => ({
  getUserKeyPair: jest.fn(),
  getUserKeyPairs: jest.fn(),
  userHasStoredKeys: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../utils/fileOperations", () => ({
  uploadAndSyncFile: jest.fn(),
}));

jest.mock("../../utils/dexieDB", () => ({
  fetchAndStoreFileMetadata: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn(),
}));

jest.mock("../../utils/gdriveKeyStorage", () => ({
  downloadEncryptedRsaKeyFromDrive: jest.fn(),
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn().mockResolvedValue({
    success: true,
    recovered: false,
    keysExisted: true,
  }),
  recoverRsaKeyVersion: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../utils/capsuleAdapter", () => ({
  openSharingKeyBackupCapsule: jest.fn(),
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
const mockGetMnemonic = getMnemonic as jest.MockedFunction<typeof getMnemonic>;
const mockGetUserKeyPair = getUserKeyPair as jest.MockedFunction<
  typeof getUserKeyPair
>;
const mockGetUserKeyPairs = getUserKeyPairs as jest.MockedFunction<
  typeof getUserKeyPairs
>;
const mockDownloadKeyBackup =
  downloadEncryptedRsaKeyFromDrive as jest.MockedFunction<
    typeof downloadEncryptedRsaKeyFromDrive
  >;
const mockDecryptKeyBackup =
  openSharingKeyBackupCapsule as jest.MockedFunction<
    typeof openSharingKeyBackupCapsule
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
const mockFetchAndStoreFileMetadata =
  fetchAndStoreFileMetadata as jest.MockedFunction<
    typeof fetchAndStoreFileMetadata
  >;

const databaseFile = {
  id: "share-123",
  content_format: "legacy_zdse",
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
    mockDownloadKeyBackup.mockResolvedValue(new Blob(["encrypted key"]));
    mockDecryptKeyBackup.mockResolvedValue({
      privateKeyJwk: {
        kty: "RSA",
        d: "private",
      },
      format: "capsule_v1",
    });
    mockGetMnemonic.mockReturnValue("valid recovery phrase");
    mockGetUserKeyPair.mockResolvedValue({
      publicKeyJwk: { kty: "RSA" },
      privateKeyJwk: { kty: "RSA", d: "private" },
      fingerprint: "a".repeat(64),
      keyVersion: 1,
    });
    mockGetUserKeyPairs.mockResolvedValue([]);
    mockDownloadEncryptedFile.mockResolvedValue(
      new Blob(["ciphertext"], { type: "application/octet-stream" }),
    );
    mockDecryptSharedFile.mockResolvedValue({
      decryptedFile: new Blob(["plaintext"], { type: "application/pdf" }),
      fileName: "project-brief.pdf",
      mimeType: "application/pdf",
    });
    mockUploadAndSyncFile.mockResolvedValue({
      id: "drive-copy",
      name: "project-brief.pdf",
      mimeType: "application/pdf",
      userEmail: "recipient@example.com",
      uploadedDate: new Date(),
      folderId: null,
    });
    mockFetchAndStoreFileMetadata.mockResolvedValue(undefined);
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
      screen.getByText(/files shared to this zerodrive account/i),
    ).toBeInTheDocument();
  });

  it("shows vault access as a clear prerequisite", async () => {
    mockGetMnemonic.mockReturnValue(null);
    renderPage();

    expect(
      await screen.findByText("Set up Recovery & Access first"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /set up access/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/recovery-access?returnTo=%2Fshared-with-me",
    );
  });

  it("directs users to sharing setup when recipient keys are missing", async () => {
    mockDownloadKeyBackup.mockRejectedValue(new Error("Backup not found"));
    mockGetMnemonic.mockReturnValue("valid recovery phrase");
    mockGetUserKeyPair.mockResolvedValue(null);
    renderPage();

    expect(
      await screen.findByText("Create your sharing identity"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /create sharing identity/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/share");
  });

  it("uses the active sharing identity already stored in this browser", async () => {
    mockGetMnemonic.mockReturnValue("valid recovery phrase");
    showFiles();
    renderPage();

    expect(await screen.findByText("project-brief.pdf")).toBeInTheDocument();
    expect(mockGetUserKeyPair).toHaveBeenCalledWith(
      "recipient@example.com",
      "valid recovery phrase",
    );
    expect(mockDownloadKeyBackup).not.toHaveBeenCalled();
    expect(mockDecryptKeyBackup).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Set up Recovery & Access first"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^download$/i })).toBeEnabled();
  });

  it("uses Recovery & Access instead of an inline sharing-key unlock", async () => {
    mockDownloadKeyBackup.mockRejectedValue(new Error("Legacy local key"));
    mockGetMnemonic.mockReturnValue(null);
    showFiles();
    renderPage();

    expect(
      await screen.findByText("Set up Recovery & Access first"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/recovery phrase/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /set up access/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/recovery-access?returnTo=%2Fshared-with-me",
    );
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
    expect(
      screen.getByText(/download saves plaintext to this device/i),
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

  it("offers historical sharing keys to Capsule for unversioned legacy shares", async () => {
    mockGetUserKeyPairs.mockResolvedValue([
      {
        publicKeyJwk: { kty: "RSA", n: "historical-public" },
        privateKeyJwk: { kty: "RSA", n: "historical-private", d: "old" },
        keyVersion: 1,
        fingerprint: "b".repeat(64),
      },
    ]);
    showFiles();
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /^download$/i }));

    await waitFor(() =>
      expect(mockDecryptSharedFile).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientPrivateKeys: expect.arrayContaining([
            expect.objectContaining({
              privateKeyJwk: expect.objectContaining({
                n: "historical-private",
              }),
              keyVersion: 1,
            }),
          ]),
        }),
      ),
    );
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
    expect(mockFetchAndStoreFileMetadata).toHaveBeenCalled();
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

  it("verifies Storage metadata before saving a shared file", async () => {
    mockFetchAndStoreFileMetadata.mockRejectedValueOnce(
      new Error("Drive unavailable"),
    );
    showFiles();
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /save to storage/i }),
    );

    await waitFor(() =>
      expect(mockFetchAndStoreFileMetadata).toHaveBeenCalled(),
    );
    expect(mockDownloadEncryptedFile).not.toHaveBeenCalled();
    expect(mockUploadAndSyncFile).not.toHaveBeenCalled();
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
