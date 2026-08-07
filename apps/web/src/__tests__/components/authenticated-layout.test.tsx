import React, { useEffect, useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthenticatedLayout } from "../../components/layout/authenticated-layout";
import { AppProvider, useApp } from "../../contexts/app-context";
import {
  useVaultData,
  VaultDataProvider,
  type VaultMetadataStatus,
} from "../../contexts/vault-data-context";
import { getStoredKey } from "../../utils/cryptoUtils";
import { RECOVERY_PHRASE_MEMORY_EVENT } from "../../utils/mnemonicManager";

jest.mock("../../utils/dexieDB", () => ({
  getAllFilesForUser: jest.fn().mockResolvedValue([]),
  getFoldersForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
  VAULT_KEY_STORAGE_EVENT: "zerodrive-vault-key-storage-changed",
}));

jest.mock("../../utils/authService", () => ({
  getOrFetchGoogleToken: jest.fn().mockResolvedValue(null),
}));

const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;

const TEST_EMAIL = "person@example.com";

function LayoutStateHarness({
  metadataStatus,
  hasVaultKey,
}: {
  metadataStatus: VaultMetadataStatus;
  hasVaultKey: boolean | null;
}) {
  const { setUserInfo } = useApp();
  const { state, replaceVaultData, setVaultKeyStatus } = useVaultData();
  const initializedRef = useRef(false);

  useEffect(() => {
    setUserInfo(TEST_EMAIL, "Person");
  }, [setUserInfo]);

  useEffect(() => {
    if (
      state.userEmail !== TEST_EMAIL ||
      state.isHydrating ||
      initializedRef.current
    ) {
      return;
    }
    initializedRef.current = true;
    replaceVaultData(TEST_EMAIL, [], [], { metadataStatus });
    if (hasVaultKey !== null) {
      setVaultKeyStatus(TEST_EMAIL, hasVaultKey);
    }
  }, [
    hasVaultKey,
    metadataStatus,
    replaceVaultData,
    setVaultKeyStatus,
    state.isHydrating,
    state.userEmail,
  ]);

  return (
    <AuthenticatedLayout>
      <div>Protected content</div>
    </AuthenticatedLayout>
  );
}

function renderLayout({
  initialPath = "/storage",
  metadataStatus = "decryption_error",
  hasVaultKey = true,
}: {
  initialPath?: string;
  metadataStatus?: VaultMetadataStatus;
  hasVaultKey?: boolean | null;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppProvider>
        <VaultDataProvider>
          <LayoutStateHarness
            metadataStatus={metadataStatus}
            hasVaultKey={hasVaultKey}
          />
        </VaultDataProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("AuthenticatedLayout vault access notice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);
  });

  it("explains a locked vault when metadata failed and no browser key exists", async () => {
    renderLayout({ hasVaultKey: false });

    expect(await screen.findByText(/vault locked/i)).toBeInTheDocument();
    expect(screen.getByText(/recover access/i)).toBeInTheDocument();
  });

  it("explains unreadable existing metadata when metadata failed and a key exists", async () => {
    renderLayout({ hasVaultKey: true });

    expect(
      await screen.findByText(/could not open existing vault metadata/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/start fresh by uploading a file/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/review access/i)).toBeInTheDocument();
  });

  it("uses metadata mismatch copy when key status is still unknown", async () => {
    renderLayout({ hasVaultKey: null });

    expect(
      await screen.findByText(/could not open existing vault metadata/i),
    ).toBeInTheDocument();
  });

  it("does not show the warning while metadata is unverified", async () => {
    renderLayout({ metadataStatus: "unverified", hasVaultKey: true });

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText(/vault locked/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/could not open existing vault metadata/i),
    ).not.toBeInTheDocument();
  });

  it("clears the stale warning when Recovery & Access changes vault access", async () => {
    renderLayout({ metadataStatus: "decryption_error", hasVaultKey: true });

    expect(
      await screen.findByText(/could not open existing vault metadata/i),
    ).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event(RECOVERY_PHRASE_MEMORY_EVENT));
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/could not open existing vault metadata/i),
      ).not.toBeInTheDocument();
    });
  });

  it("does not repeat the global vault warning on Recovery & Access", async () => {
    renderLayout({
      initialPath: "/recovery-access",
      metadataStatus: "decryption_error",
      hasVaultKey: false,
    });

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText(/vault locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recover access/i)).not.toBeInTheDocument();
  });
});
