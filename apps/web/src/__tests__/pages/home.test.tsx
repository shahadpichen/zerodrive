import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../pages/home";
import {
  fetchAndStoreFileMetadata,
  getAllFilesForUser,
  getFoldersForUser,
} from "../../utils/dexieDB";
import { recoverRsaKeysIfNeeded } from "../../utils/rsaKeyRecovery";
import { initializeGapi } from "../../utils/gapiInit";
import { gapi } from "gapi-script";
import {
  getVaultSetupState,
  readBrowserVaultSetupSnapshot,
} from "../../utils/vaultSetupState";
import { queueHomeLoginWelcome } from "../../utils/homeWelcome";
import { writeCachedHomeDashboard } from "../../utils/homeDashboardCache";
import { getAuthenticatedUser } from "../../utils/authService";
import { AppProvider } from "../../contexts/app-context";
import { VaultDataProvider } from "../../contexts/vault-data-context";

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
const mockInitializeGapi = initializeGapi as jest.MockedFunction<
  typeof initializeGapi
>;
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
  primaryActionPath: "/recovery-access?returnTo=%2Fhome",
  tasks: [
    {
      id: "key",
      label: "Create or recover vault access",
      description:
        "This browser needs your encryption key before it can protect files.",
      complete: false,
      actionLabel: "Set up access",
      actionPath: "/recovery-access?returnTo=%2Fhome",
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
      <AppProvider>
        <VaultDataProvider>
          <Home />
        </VaultDataProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("Home guided vault setup", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllFilesForUser.mockReset();
    mockGetFoldersForUser.mockReset();
    mockFetchAndStoreFileMetadata.mockReset();
    mockRecoverRsaKeysIfNeeded.mockReset();
    mockInitializeGapi.mockReset();
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
    mockInitializeGapi.mockResolvedValue(undefined);
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

    expect(
      screen.getByText("Setting up your private vault"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetAuthenticatedUser).toHaveBeenCalled());
  });

  it("shows a stable loading headline while vault state is checked", () => {
    renderHome();

    expect(
      screen.getByText("Setting up your private vault"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
  });

  it("holds Share Files clicks while access state is still loading", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: /share files/i }));

    expect(screen.getByText("Checking Recovery & Access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
    expect(mockNavigate).not.toHaveBeenCalledWith("/share");
  });

  it("shows the login welcome only for the first Home visit after sign-in", async () => {
    queueHomeLoginWelcome();

    const { unmount } = renderHome();

    expect(await screen.findByText("Welcome back")).toBeInTheDocument();

    unmount();
    renderHome();

    expect(
      screen.getByText("Setting up your private vault"),
    ).toBeInTheDocument();
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

  it("shows a real fallback when Google Drive initialization fails", async () => {
    mockInitializeGapi.mockRejectedValue(new Error("Drive unavailable"));

    renderHome();

    expect(
      await screen.findByText("Could not check your vault"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Setting up your private vault"),
    ).not.toBeInTheDocument();
  });
});
