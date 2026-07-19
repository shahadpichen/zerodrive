import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShareFilesPage from "../../pages/share-files";
import {
  fetchRecipientPublicKey,
  prepareFileForSharing,
  storeFileShare,
} from "../../utils/fileSharing";
import { getMnemonic } from "../../utils/mnemonicManager";
import { recoverRsaKeysIfNeeded } from "../../utils/rsaKeyRecovery";
import apiClient from "../../utils/apiClient";
import {
  getUserEmail,
  hasGoogleTokensInStorage,
} from "../../utils/authService";
import { initializeGapi } from "../../utils/gapiInit";
import { getGoogleAccessToken } from "../../utils/gapiInit";
import {
  fetchAndStoreFileMetadata,
  getAllFilesForUser,
} from "../../utils/dexieDB";
import { decryptFile } from "../../utils/decryptFile";
import { pinRecipientKey } from "../../utils/recipientKeyPins";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/authService", () => ({
  getUserEmail: jest.fn().mockResolvedValue("sender@example.com"),
  hasGoogleTokensInStorage: jest.fn().mockReturnValue(true),
  logout: jest.fn(),
}));

jest.mock("../../utils/gapiInit", () => ({
  initializeGapi: jest.fn().mockResolvedValue(undefined),
  getGoogleAccessToken: jest.fn(),
}));

jest.mock("../../utils/dexieDB", () => ({
  fetchAndStoreFileMetadata: jest.fn(),
  getAllFilesForUser: jest.fn(),
}));

jest.mock("../../utils/decryptFile", () => ({
  decryptFile: jest.fn(),
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn(),
}));

jest.mock("../../utils/fileSharing", () => ({
  fetchRecipientPublicKey: jest.fn(),
  fetchUserPublicKey: jest.fn(),
  generateUserKeyPair: jest.fn(),
  prepareFileForSharing: jest.fn(),
  storeFileShare: jest.fn(),
  storeUserPublicKey: jest.fn(),
}));

jest.mock("../../utils/keyStorage", () => ({
  deleteUserKeyPair: jest.fn(),
  getUserKeyPair: jest.fn(),
  storeUserKeyPair: jest.fn(),
}));

jest.mock("../../utils/rsaKeyManager", () => ({
  encryptRsaPrivateKeyWithAesKey: jest.fn(),
}));

jest.mock("../../utils/gdriveKeyStorage", () => ({
  uploadEncryptedRsaKeyToDrive: jest.fn(),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
}));

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      data: { email: "sender@example.com", emailHash: "f".repeat(64) },
    }),
    publicKeys: { delete: jest.fn() },
    invitations: { send: jest.fn() },
  },
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

const mockRecoverKeys = recoverRsaKeysIfNeeded as jest.MockedFunction<
  typeof recoverRsaKeysIfNeeded
>;
const mockGetMnemonic = getMnemonic as jest.MockedFunction<typeof getMnemonic>;
const mockFetchPublicKey = fetchRecipientPublicKey as jest.MockedFunction<
  typeof fetchRecipientPublicKey
>;
const mockPrepareFile = prepareFileForSharing as jest.MockedFunction<
  typeof prepareFileForSharing
>;
const mockStoreFileShare = storeFileShare as jest.MockedFunction<
  typeof storeFileShare
>;
const mockGetUserEmail = getUserEmail as jest.MockedFunction<
  typeof getUserEmail
>;
const mockHasGoogleTokens = hasGoogleTokensInStorage as jest.MockedFunction<
  typeof hasGoogleTokensInStorage
>;
const mockInitializeGapi = initializeGapi as jest.MockedFunction<
  typeof initializeGapi
>;
const mockGetGoogleAccessToken = getGoogleAccessToken as jest.MockedFunction<
  typeof getGoogleAccessToken
>;
const mockFetchStorageMetadata =
  fetchAndStoreFileMetadata as jest.MockedFunction<
    typeof fetchAndStoreFileMetadata
  >;
const mockGetStoredFiles = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockDecryptFile = decryptFile as jest.MockedFunction<typeof decryptFile>;

function renderPage() {
  return render(
    <MemoryRouter>
      <ShareFilesPage />
    </MemoryRouter>,
  );
}

async function fillShareDetails() {
  await screen.findByText("Choose a file");

  const file = new File(["encrypted later"], "roadmap.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("File to share"), {
    target: { files: [file] },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "recipient@example.com" },
  });
  return file;
}

describe("ShareFilesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { email: "sender@example.com", emailHash: "f".repeat(64) },
    });
    mockGetUserEmail.mockResolvedValue("sender@example.com");
    mockHasGoogleTokens.mockReturnValue(true);
    mockInitializeGapi.mockResolvedValue(undefined);
    mockGetGoogleAccessToken.mockResolvedValue("google-token");
    mockFetchStorageMetadata.mockResolvedValue(undefined);
    mockGetStoredFiles.mockResolvedValue([]);
    mockDecryptFile.mockResolvedValue(
      new Blob(["stored plaintext"], { type: "application/pdf" }),
    );
    mockGetMnemonic.mockReturnValue(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );
    mockRecoverKeys.mockResolvedValue({
      success: true,
      recovered: false,
      keysExisted: true,
    });
    mockFetchPublicKey.mockResolvedValue({
      public_key: JSON.stringify({ kty: "RSA" }),
      key_version: 1,
      fingerprint: "a".repeat(64),
    });
    mockPrepareFile.mockResolvedValue({
      encryptedFileBlob: new Blob(["ciphertext"]),
      recipientEmail: "recipient@example.com",
      fileName: "encrypted-file.bin",
      originalFileName: "roadmap.pdf",
      encryptedFileKey: "wrapped-key",
      encryptedMetadata: "encrypted-metadata",
      fileId: "file-id",
      mimeType: "application/pdf",
      fileSize: 15,
      recipientKeyVersion: 1,
      recipientKeyFingerprint: "a".repeat(64),
    });
    mockStoreFileShare.mockResolvedValue(undefined);
    (apiClient.invitations.send as jest.Mock).mockResolvedValue({
      sent: true,
      remaining: 4,
      resetTime: Date.now(),
    });
  });

  it("shows a focused file and recipient workflow when sharing is ready", async () => {
    renderPage();

    expect(await screen.findByText("Choose a file")).toBeInTheDocument();
    expect(screen.getByText("Share a file")).toBeInTheDocument();
    expect(screen.getByText("Choose the recipient")).toBeInTheDocument();
    expect(
      screen.getByText("The original file never reaches our server."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only the chosen recipient can unlock it/i),
    ).toBeInTheDocument();
  });

  it("presents sharing setup as a blocking prerequisite", async () => {
    mockRecoverKeys.mockResolvedValue({
      success: true,
      recovered: false,
      keysExisted: false,
    });
    renderPage();

    expect(
      await screen.findByText("Create your sharing identity"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create sharing identity/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("File to share")).not.toBeInTheDocument();
  });

  it("preserves /share as the return destination for Recovery & Access", async () => {
    mockRecoverKeys.mockResolvedValue({
      success: true,
      recovered: false,
      keysExisted: false,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /manage encryption key/i,
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/recovery-access?returnTo=%2Fshare",
    );
  });

  it("asks for the recovery phrase before exposing the share form", async () => {
    mockGetMnemonic.mockReturnValue(null);
    renderPage();

    expect(
      await screen.findByText("Unlock your sharing keys"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Recovery phrase")).toBeInTheDocument();
    expect(screen.queryByLabelText("File to share")).not.toBeInTheDocument();
  });

  it("validates the recipient before showing the review", async () => {
    renderPage();
    await fillShareDetails();

    fireEvent.click(screen.getByRole("button", { name: /review share/i }));

    await screen.findByText("Review before sharing");
    expect(mockFetchPublicKey).toHaveBeenCalledWith("recipient@example.com");
    expect(screen.getByText("roadmap.pdf")).toBeInTheDocument();
    expect(screen.getByText("recipient@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/recipient-only encrypted copy/i),
    ).toBeInTheDocument();
  });

  it("blocks a changed recipient key until the sender confirms it", async () => {
    pinRecipientKey("f".repeat(64), "recipient@example.com", "b".repeat(64), 1);
    mockFetchPublicKey.mockResolvedValue({
      public_key: JSON.stringify({ kty: "RSA", n: "new-key" }),
      key_version: 2,
      fingerprint: "c".repeat(64),
    });
    renderPage();
    await fillShareDetails();

    fireEvent.click(screen.getByRole("button", { name: /review share/i }));

    expect(
      await screen.findByText(/recipient's encryption key changed/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Review before sharing")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /trust this new key/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /review share/i }));

    expect(
      await screen.findByText("Review before sharing"),
    ).toBeInTheDocument();
  });

  it("can select and share a file already in My Storage", async () => {
    mockGetStoredFiles.mockResolvedValue([
      {
        id: "drive-file-123",
        name: "stored-report.pdf",
        mimeType: "application/pdf",
        userEmail: "sender@example.com",
        uploadedDate: new Date("2026-07-01T10:00:00Z"),
        folderId: null,
      },
    ]);
    const encryptedBlob = new Blob(["encrypted personal file"]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(encryptedBlob),
    });

    renderPage();
    await screen.findByText("Choose a file");
    fireEvent.click(screen.getByRole("tab", { name: /my storage/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /stored-report\.pdf/i }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "recipient@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review share/i }));
    await screen.findByText("Review before sharing");
    fireEvent.click(screen.getByRole("button", { name: /encrypt and share/i }));

    expect(await screen.findByText("File shared")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/drive-file-123?alt=media",
      { headers: { Authorization: "Bearer google-token" } },
    );
    expect(mockDecryptFile).toHaveBeenCalledWith(encryptedBlob);
    expect(mockPrepareFile.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: "stored-report.pdf",
        type: "application/pdf",
      }),
    );
  });

  it("shows a persistent success state after sharing", async () => {
    renderPage();
    await fillShareDetails();
    fireEvent.click(screen.getByRole("button", { name: /review share/i }));
    await screen.findByText("Review before sharing");

    fireEvent.click(screen.getByRole("button", { name: /encrypt and share/i }));

    expect(await screen.findByText("File shared")).toBeInTheDocument();
    expect(
      screen.getByText(/only this recipient can unlock the encrypted copy/i),
    ).toBeInTheDocument();
    expect(mockPrepareFile).toHaveBeenCalled();
    expect(mockStoreFileShare).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /share another file/i }),
    ).toBeInTheDocument();
  });

  it("offers an invitation before uploading when the recipient is not ready", async () => {
    mockFetchPublicKey.mockResolvedValue(null);
    renderPage();
    await fillShareDetails();

    fireEvent.click(screen.getByRole("button", { name: /review share/i }));

    expect(
      await screen.findByText("This recipient is not ready yet"),
    ).toBeInTheDocument();
    expect(mockPrepareFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => {
      expect(apiClient.invitations.send).toHaveBeenCalledWith({
        recipient_email: "recipient@example.com",
        sender_message: undefined,
      });
    });
    expect(await screen.findByText(/invitation sent/i)).toBeInTheDocument();
  });
});
