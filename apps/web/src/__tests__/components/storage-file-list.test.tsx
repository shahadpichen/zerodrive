import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileList } from "../../components/storage/file-list";
import { getFilesInFolder, getFoldersForUser } from "../../utils/dexieDB";
import { useFolderContext } from "../../components/storage/folder-context";

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

const mockGetFilesInFolder = getFilesInFolder as jest.MockedFunction<
  typeof getFilesInFolder
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockUseFolderContext = useFolderContext as jest.MockedFunction<
  typeof useFolderContext
>;

describe("Storage FileList empty state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFolderContext.mockReturnValue({
      currentFolderId: null,
      currentPath: [],
      navigateToFolder: jest.fn(),
      navigateUp: jest.fn(),
      goToRoot: jest.fn(),
      setCurrentPath: jest.fn(),
    });
    mockGetFilesInFolder.mockResolvedValue([]);
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
      await screen.findByText("Set up vault access first."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not have vault access yet/i),
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
