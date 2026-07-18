import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KeyManagementPage } from "../../pages/key-management-page";
import {
  deriveKeyFromMnemonic,
  generateMnemonic,
  getStoredKey,
  storeKey,
} from "../../utils/cryptoUtils";
import { getMnemonic } from "../../utils/mnemonicManager";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../utils/cryptoUtils", () => ({
  deriveKeyFromMnemonic: jest.fn(),
  generateMnemonic: jest.fn(),
  getStoredKey: jest.fn(),
  storeKey: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn(),
  setMnemonic: jest.fn(),
}));

jest.mock("../../utils/keyTest", () => ({
  testEncryptionKey: jest.fn().mockResolvedValue({
    success: true,
    message: "Key works",
  }),
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn(),
}));

jest.mock("../../utils/authService", () => ({
  getUserEmail: jest.fn().mockResolvedValue("user@example.com"),
  hasGoogleTokensInStorage: jest.fn().mockReturnValue(true),
}));

jest.mock("../../utils/gapiInit", () => ({
  initializeGapi: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../components/key-management/DeviceManagement", () => ({
  DeviceManagement: () => <div>Current browser key status</div>,
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockDeriveKey = deriveKeyFromMnemonic as jest.MockedFunction<
  typeof deriveKeyFromMnemonic
>;
const mockGenerateMnemonic = generateMnemonic as jest.MockedFunction<
  typeof generateMnemonic
>;
const mockStoreKey = storeKey as jest.MockedFunction<typeof storeKey>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;
const mockGetMnemonic = getMnemonic as jest.MockedFunction<typeof getMnemonic>;

const mnemonic =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";

function renderPage(initialEntry = "/recovery-access") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <KeyManagementPage />
    </MemoryRouter>,
  );
}

async function generateNewKey() {
  fireEvent.click(screen.getByRole("tab", { name: /create new key/i }));
  fireEvent.click(screen.getByRole("button", { name: /create new key/i }));
  fireEvent.click(
    screen.getByLabelText(/losing this phrase means permanent loss/i),
  );
  fireEvent.click(screen.getByLabelText(/ready to save the recovery phrase/i));
  fireEvent.click(
    screen.getByRole("button", { name: /create encryption key/i }),
  );
  await screen.findAllByText("Your vault is ready");
}

describe("KeyManagementPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    mockGenerateMnemonic.mockReturnValue(mnemonic);
    mockDeriveKey.mockResolvedValue({} as CryptoKey);
    mockGetStoredKey.mockResolvedValue(null);
    mockGetMnemonic.mockReturnValue(null);
    mockStoreKey.mockResolvedValue(undefined);
  });

  it("opens in a focused recovery mode", () => {
    renderPage();

    expect(screen.getByText("Recovery & Access")).toBeInTheDocument();
    expect(screen.getByText("Recover your key")).toBeInTheDocument();
    expect(screen.getByLabelText("Recovery phrase")).toBeInTheDocument();
    expect(screen.getByText(/never sent to the server/i)).toBeInTheDocument();
    expect(screen.getByText("Current browser key status")).toBeInTheDocument();
  });

  it("switches cleanly between recovery and key creation", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /create new key/i }));
    expect(screen.getByText("Create a new encryption key")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /recover existing key/i }));
    expect(screen.getByText("Recover your key")).toBeInTheDocument();
  });

  it("requires both safety acknowledgements before generation", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /create new key/i }));
    fireEvent.click(screen.getByRole("button", { name: /create new key/i }));

    const confirm = screen.getByRole("button", {
      name: /create encryption key/i,
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(/losing this phrase means permanent loss/i),
    );
    expect(confirm).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(/ready to save the recovery phrase/i),
    );
    expect(confirm).toBeEnabled();
  });

  it("presents a scannable recovery phrase and next actions", async () => {
    renderPage();
    await generateNewKey();

    mnemonic.split(" ").forEach((word) => {
      expect(screen.getByText(word)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /copy phrase/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download phrase/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload first encrypted file/i }),
    ).toBeInTheDocument();
  });

  it("recovers a valid phrase and returns to storage", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Recovery phrase"), {
      target: { value: mnemonic },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /recover and continue/i }),
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/storage"));
    expect(mockDeriveKey).toHaveBeenCalledWith(mnemonic);
    expect(mockStoreKey).toHaveBeenCalled();
  });

  it("returns to sharing when Recovery & Access was opened from /share", async () => {
    renderPage("/recovery-access?returnTo=%2Fshare");
    fireEvent.change(screen.getByLabelText("Recovery phrase"), {
      target: { value: mnemonic },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /recover and continue/i }),
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/share");
    });
  });

  it("shows an inline error for an invalid recovery phrase", async () => {
    mockDeriveKey.mockRejectedValue(new Error("Invalid mnemonic phrase"));
    renderPage();
    fireEvent.change(screen.getByLabelText("Recovery phrase"), {
      target: { value: "invalid phrase" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /recover and continue/i }),
    );

    expect(
      await screen.findByText(/recovery phrase is not valid/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps legacy JSON import available without dominating the page", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /import a legacy json key/i }),
    );

    expect(
      screen.getByLabelText("Upload your encryption key file"),
    ).toBeInTheDocument();
  });
});
