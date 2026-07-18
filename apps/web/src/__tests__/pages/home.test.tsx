import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
import { queueHomeLoginWelcome } from "../../utils/homeWelcome";
import { writeCachedHomeDashboard } from "../../utils/homeDashboardCache";
import { getAuthenticatedUser } from "../../utils/authService";

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
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<
  typeof getAuthenticatedUser
>;

const needsKeyState = {
  status: "needs_key",
  badge: "Vault setup",
  headline: "Create or recover vault access",
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

const vaultReadyState = {
  status: "vault_ready",
  badge: "Vault active",
  headline: "Welcome back to your private vault",
  description:
    "Your encrypted storage is ready. Recent files, sharing, recovery, and inbox access are all one step away.",
  primaryActionLabel: "Open Storage",
  primaryActionPath: "/storage",
  tasks: [],
  shouldShowGuidance: false,
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
    mockGetAuthenticatedUser.mockResolvedValue({
      email: "owner@example.com",
      capabilities: { analyticsRead: false },
    } as any);
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("google-tokens", "{}");
    currentVaultSetupState = needsKeyState;
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

  it("shows a neutral setup headline while vault state resolves", async () => {
    currentVaultSetupState = needsKeyState;

    renderHome();

    expect(screen.getByText("Setting up your private vault")).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetAuthenticatedUser).toHaveBeenCalled());
  });

  it("shows a stable loading headline while vault state is checked", () => {
    renderHome();

    expect(screen.getByText("Setting up your private vault")).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
  });

  it("shows the login welcome only for the first Home visit after sign-in", async () => {
    queueHomeLoginWelcome();

    const { unmount } = renderHome();

    expect(await screen.findByText("Welcome back")).toBeInTheDocument();

    unmount();
    renderHome();

    expect(screen.getByText("Setting up your private vault")).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
  });

  it("does not render cached dashboard state for a different backend-authenticated user", async () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "owner@example.com" }),
    );
    writeCachedHomeDashboard({
      userEmail: "owner@example.com",
      counts: { files: 2, folders: 1 },
      recent: [],
      canReadAnalytics: false,
      vaultSetup: vaultReadyState as any,
    });
    mockGetAuthenticatedUser.mockResolvedValue({
      email: "other@example.com",
      capabilities: { analyticsRead: false },
    } as any);

    renderHome();

    await waitFor(() => expect(mockGetAuthenticatedUser).toHaveBeenCalled());
    expect(
      screen.queryByText("Welcome back to your private vault"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("2 files · 1 folders")).not.toBeInTheDocument();
  });
});
