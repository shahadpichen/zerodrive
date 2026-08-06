import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "../../contexts/app-context";
import {
  useVaultData,
  VaultDataProvider,
} from "../../contexts/vault-data-context";
import { getAllFilesForUser, getFoldersForUser } from "../../utils/dexieDB";
import { getStoredKey } from "../../utils/cryptoUtils";
import { AUTH_SESSION_CLEARED_EVENT } from "../../utils/authEvents";
import { RECOVERY_PHRASE_MEMORY_EVENT } from "../../utils/mnemonicManager";

jest.mock("../../utils/dexieDB", () => ({
  getAllFilesForUser: jest.fn(),
  getFoldersForUser: jest.fn(),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
  VAULT_KEY_STORAGE_EVENT: "zerodrive-vault-key-storage-changed",
}));

jest.mock("../../utils/authService", () => ({
  getOrFetchGoogleToken: jest.fn().mockResolvedValue(null),
}));

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetFoldersForUser = getFoldersForUser as jest.MockedFunction<
  typeof getFoldersForUser
>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;

function VaultHarness() {
  const { setUserInfo, userName, userImage } = useApp();
  const { state, setVaultMetadataStatus } = useVaultData();

  return (
    <div>
      <button onClick={() => setUserInfo("first@example.com", "First")}>
        first
      </button>
      <button
        onClick={() =>
          setUserInfo(
            "first@example.com",
            "First Person",
            "https://example.com/avatar.png",
          )
        }
      >
        full profile
      </button>
      <button onClick={() => setUserInfo("first@example.com", "first")}>
        fallback profile
      </button>
      <button onClick={() => setUserInfo("second@example.com", "Second")}>
        second
      </button>
      <button
        onClick={() =>
          setVaultMetadataStatus("first@example.com", "ready")
        }
      >
        metadata ready
      </button>
      <div data-testid="account">{state.userEmail}</div>
      <div data-testid="user-name">{userName}</div>
      <div data-testid="user-image">{userImage}</div>
      <div data-testid="status">
        {state.isHydrating ? "hydrating" : "ready"}
      </div>
      <div data-testid="metadata-status">{state.metadataStatus}</div>
      <div data-testid="files">
        {state.files.map((file) => file.name).join(",")}
      </div>
    </div>
  );
}

function renderVaultHarness() {
  return render(
    <AppProvider>
      <VaultDataProvider>
        <VaultHarness />
      </VaultDataProvider>
    </AppProvider>,
  );
}

describe("VaultDataProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockGetFoldersForUser.mockResolvedValue([]);
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);
    mockGetAllFilesForUser.mockImplementation(async (email) => [
      {
        id: `${email}-file`,
        name: `${email}-notes.pdf`,
        mimeType: "application/pdf",
        userEmail: email,
        uploadedDate: new Date("2026-07-19T00:00:00.000Z"),
        folderId: null,
      },
    ]);
  });

  it("hydrates local vault data once and keeps it in shared memory", async () => {
    renderVaultHarness();

    await userEvent.click(screen.getByRole("button", { name: "first" }));

    expect(
      await screen.findByText("first@example.com-notes.pdf"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("keeps a known profile stable when fallback auth data arrives for the same account", async () => {
    renderVaultHarness();

    await userEvent.click(screen.getByRole("button", { name: "full profile" }));

    expect(screen.getByTestId("user-name")).toHaveTextContent("First Person");
    expect(screen.getByTestId("user-image")).toHaveTextContent(
      "https://example.com/avatar.png",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "fallback profile" }),
    );

    expect(screen.getByTestId("user-name")).toHaveTextContent("First Person");
    expect(screen.getByTestId("user-image")).toHaveTextContent(
      "https://example.com/avatar.png",
    );
  });

  it("does not hydrate cached profile data for a different token session", () => {
    localStorage.setItem(
      "zerodrive-user-info-cache",
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        email: "first@example.com",
        name: "First Person",
        image: "https://example.com/avatar.png",
      }),
    );
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "second@example.com" }),
    );

    renderVaultHarness();

    expect(screen.getByTestId("user-name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("user-image")).toBeEmptyDOMElement();
  });

  it("does not expose the previous account while an account switch hydrates", async () => {
    let resolveSecondAccount: ((value: any[]) => void) | undefined;
    mockGetAllFilesForUser.mockImplementation((email) => {
      if (email === "second@example.com") {
        return new Promise((resolve) => {
          resolveSecondAccount = resolve;
        });
      }
      return Promise.resolve([
        {
          id: "first-file",
          name: "first-private-file.pdf",
          mimeType: "application/pdf",
          userEmail: email,
          uploadedDate: new Date("2026-07-19T00:00:00.000Z"),
          folderId: null,
        },
      ]);
    });

    renderVaultHarness();
    await userEvent.click(screen.getByRole("button", { name: "first" }));
    expect(
      await screen.findByText("first-private-file.pdf"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "second" }));

    expect(screen.getByTestId("account")).toHaveTextContent(
      "second@example.com",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("hydrating");
    expect(
      screen.queryByText("first-private-file.pdf"),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveSecondAccount?.([]);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
  });

  it("clears hydrating state when local vault hydration fails", async () => {
    mockGetAllFilesForUser.mockRejectedValue(new Error("IndexedDB failed"));

    renderVaultHarness();
    await userEvent.click(screen.getByRole("button", { name: "first" }));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("files")).toBeEmptyDOMElement();
  });

  it("clears the account-scoped snapshot when authentication is cleared", async () => {
    renderVaultHarness();
    await userEvent.click(screen.getByRole("button", { name: "first" }));
    expect(
      await screen.findByText("first@example.com-notes.pdf"),
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
    });

    expect(screen.getByTestId("account")).toBeEmptyDOMElement();
    expect(screen.getByTestId("files")).toBeEmptyDOMElement();
  });

  it("invalidates metadata verification when the recovery phrase changes", async () => {
    renderVaultHarness();
    await userEvent.click(screen.getByRole("button", { name: "first" }));
    await userEvent.click(
      screen.getByRole("button", { name: "metadata ready" }),
    );
    expect(screen.getByTestId("metadata-status")).toHaveTextContent("ready");

    act(() => {
      window.dispatchEvent(new Event(RECOVERY_PHRASE_MEMORY_EVENT));
    });

    expect(screen.getByTestId("metadata-status")).toHaveTextContent(
      "unverified",
    );
  });
});
