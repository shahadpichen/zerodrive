import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../pages/home";
import {
  fetchAndStoreFileMetadata,
  getAllFilesForUser,
  getFoldersForUser,
} from "../../utils/dexieDB";
import { recoverRsaKeysIfNeeded } from "../../utils/rsaKeyRecovery";
import { gapi } from "gapi-script";
import {
  getVaultSetupState,
  readBrowserVaultSetupSnapshot,
} from "../../utils/vaultSetupState";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/authService", () => ({
  getAuthenticatedUser: jest.fn().mockResolvedValue({
    email: "owner@example.com",
    capabilities: { analyticsRead: false },
  }),
  getUserProfile: jest.fn().mockResolvedValue({
    email: "owner@example.com",
    name: "Owner",
    picture: "",
  }),
  getOrFetchGoogleToken: jest.fn().mockResolvedValue("google-token"),
  hasGoogleTokensInStorage: jest.fn().mockReturnValue(true),
  logout: jest.fn(),
}));

jest.mock("../../utils/gapiInit", () => ({
  initializeGapi: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/dexieDB", () => ({
  fetchAndStoreFileMetadata: jest.fn().mockResolvedValue(undefined),
  getAllFilesForUser: jest.fn(),
  getFoldersForUser: jest.fn(),
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn().mockResolvedValue({
    success: true,
    recovered: false,
    keysExisted: false,
  }),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn().mockReturnValue(null),
}));

jest.mock("../../utils/vaultSetupState", () => ({
  dismissOnboardingGuidance: jest.fn(),
  getVaultSetupState: jest.fn(),
  readBrowserVaultSetupSnapshot: jest.fn(),
}));

jest.mock("gapi-script", () => ({
  gapi: {
    client: {
      request: jest.fn().mockResolvedValue({
        result: { storageQuota: { usage: "0", limit: "1000" } },
      }),
    },
  },
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn() },
}));

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockFetchAndStoreFileMetadata =
  fetchAndStoreFileMetadata as jest.MockedFunction<
    typeof fetchAndStoreFileMetadata
  >;
const mockRecoverRsaKeysIfNeeded =
  recoverRsaKeysIfNeeded as jest.MockedFunction<typeof recoverRsaKeysIfNeeded>;
const mockGapiRequest = gapi.client.request as jest.MockedFunction<
  typeof gapi.client.request
>;
const mockReadBrowserVaultSetupSnapshot =
  readBrowserVaultSetupSnapshot as jest.MockedFunction<
    typeof readBrowserVaultSetupSnapshot
  >;
const mockGetVaultSetupState = getVaultSetupState as jest.MockedFunction<
  typeof getVaultSetupState
>;

const needsKeyState = {
  status: "needs_key",
  badge: "Vault setup",
  headline: "Set up your private vault",
  description:
    "Create or recover your encryption key. This key protects your vault, and ZeroDrive cannot read or reset it.",
  primaryActionLabel: "Create or recover access",
  primaryActionPath: "/key-management",
  tasks: [
    {
      id: "key",
      label: "Create or recover vault access",
      description:
        "This browser needs your encryption key before it can protect files.",
      complete: false,
      actionLabel: "Set up access",
      actionPath: "/key-management",
    },
  ],
  shouldShowGuidance: true,
} as const;

let currentVaultSetupState = needsKeyState;

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home guided vault setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllFilesForUser.mockReset();
    mockGetFoldersForUser.mockReset();
    mockFetchAndStoreFileMetadata.mockReset();
    mockRecoverRsaKeysIfNeeded.mockReset();
    mockGapiRequest.mockReset();
    mockReadBrowserVaultSetupSnapshot.mockReset();
    mockGetVaultSetupState.mockReset();
    localStorage.clear();
    sessionStorage.setItem("google-tokens", "{}");
    mockFetchAndStoreFileMetadata.mockResolvedValue(undefined);
    mockGetAllFilesForUser.mockResolvedValue([]);
    mockGetFoldersForUser.mockResolvedValue([]);
    mockRecoverRsaKeysIfNeeded.mockResolvedValue({
      success: true,
      recovered: false,
      keysExisted: false,
    });
    mockGapiRequest.mockResolvedValue({
      result: { storageQuota: { usage: "0", limit: "1000" } },
    } as any);
    mockReadBrowserVaultSetupSnapshot.mockResolvedValue({
      isAuthenticated: true,
      hasGoogleTokens: true,
      hasPrimaryKey: false,
      hasRecoveryPhrase: false,
      fileCount: 0,
      folderCount: 0,
      hasSharingKeys: false,
      guidanceDismissed: false,
    });
    mockGetVaultSetupState.mockImplementation(
      () => currentVaultSetupState as any,
    );
  });

  it("shows vault setup guidance when this browser has no encryption key", async () => {
    currentVaultSetupState = needsKeyState;

    renderHome();

    expect(
      await screen.findByText("Set up your private vault"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create or recover access/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create or recover vault access"),
    ).toBeInTheDocument();
  });
});
