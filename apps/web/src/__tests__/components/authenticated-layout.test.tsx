import React, { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthenticatedLayout } from "../../components/layout/authenticated-layout";
import { useApp } from "../../contexts/app-context";
import { getStoredKey } from "../../utils/cryptoUtils";

jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
  VAULT_KEY_STORAGE_EVENT: "zerodrive-vault-key-storage-changed",
}));

const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;

function TriggerDecryptionIssue() {
  const { setDecryptionError } = useApp();

  useEffect(() => {
    setDecryptionError(true);
  }, [setDecryptionError]);

  return <div>Protected content</div>;
}

function renderLayout(initialPath = "/storage") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthenticatedLayout>
        <TriggerDecryptionIssue />
      </AuthenticatedLayout>
    </MemoryRouter>,
  );
}

describe("AuthenticatedLayout vault access notice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("explains a locked vault when no browser key exists", async () => {
    mockGetStoredKey.mockResolvedValue(null);

    renderLayout();

    expect(await screen.findByText(/vault locked/i)).toBeInTheDocument();
    expect(screen.getByText(/recover access/i)).toBeInTheDocument();
  });

  it("explains unreadable existing metadata when a key exists", async () => {
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);

    renderLayout();

    expect(
      await screen.findByText(/could not open existing vault metadata/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/start fresh by uploading a file/i)).toBeInTheDocument();
    expect(screen.getByText(/review access/i)).toBeInTheDocument();
  });

  it("updates the notice when vault access becomes available", async () => {
    mockGetStoredKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({} as CryptoKey);

    renderLayout();

    expect(await screen.findByText(/vault locked/i)).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new Event("zerodrive-vault-key-storage-changed"),
      );
    });

    expect(
      await screen.findByText(/could not open existing vault metadata/i),
    ).toBeInTheDocument();
  });

  it("does not repeat the global vault warning on key management", async () => {
    mockGetStoredKey.mockResolvedValue(null);

    renderLayout("/key-management");

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText(/vault locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recover access/i)).not.toBeInTheDocument();
  });
});
