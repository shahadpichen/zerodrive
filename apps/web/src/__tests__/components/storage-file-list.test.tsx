import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileList } from "../../components/storage/file-list";
import { getAllFilesForUser, getFoldersForUser } from "../../utils/dexieDB";
import { useFolderContext } from "../../components/storage/folder-context";
import { useOptionalVaultData } from "../../contexts/vault-data-context";

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
  getStoredKey: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    loading: jest.fn(),
    success: jest.fn(),
  },
}));

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
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
});
