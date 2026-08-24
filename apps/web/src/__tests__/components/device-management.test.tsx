import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeviceManagement } from "../../components/key-management/DeviceManagement";
import { prepareForAuthSessionClear } from "../../utils/authEvents";
import { clearStoredKey } from "../../utils/cryptoUtils";
import { clearMnemonic } from "../../utils/mnemonicManager";
import { getVaultAccessKind } from "../../utils/vaultAccess";

jest.mock("../../utils/authEvents", () => ({
  prepareForAuthSessionClear: jest.fn(),
}));

jest.mock("../../utils/cryptoUtils", () => ({
  clearStoredKey: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  clearMnemonic: jest.fn(),
}));

jest.mock("../../utils/vaultAccess", () => ({
  getVaultAccessKind: jest.fn(),
}));

const mockPrepareForAuthSessionClear =
  prepareForAuthSessionClear as jest.MockedFunction<
    typeof prepareForAuthSessionClear
  >;
const mockClearStoredKey = clearStoredKey as jest.MockedFunction<
  typeof clearStoredKey
>;
const mockClearMnemonic = clearMnemonic as jest.MockedFunction<
  typeof clearMnemonic
>;
const mockGetVaultAccessKind = getVaultAccessKind as jest.MockedFunction<
  typeof getVaultAccessKind
>;

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("DeviceManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVaultAccessKind.mockResolvedValue("recovery_phrase");
    mockPrepareForAuthSessionClear.mockResolvedValue(undefined);
  });

  it("shows the Lock vault action when recovery access is active", async () => {
    render(<DeviceManagement />);

    expect(await screen.findByText("Recovery phrase active")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /lock vault/i }),
    ).toBeInTheDocument();
  });

  it("waits for session cleanup before clearing recovery and legacy keys", async () => {
    const cleanup = createDeferred();
    mockPrepareForAuthSessionClear.mockReturnValue(cleanup.promise);
    render(<DeviceManagement />);

    const lockButton = await screen.findByRole("button", {
      name: /lock vault/i,
    });
    fireEvent.click(lockButton);

    await waitFor(() => {
      expect(mockPrepareForAuthSessionClear).toHaveBeenCalledTimes(1);
    });
    expect(lockButton).toBeDisabled();
    expect(mockClearMnemonic).not.toHaveBeenCalled();
    expect(mockClearStoredKey).not.toHaveBeenCalled();
    expect(screen.getByText("Recovery phrase active")).toBeInTheDocument();

    cleanup.resolve();

    await waitFor(() => {
      expect(mockClearMnemonic).toHaveBeenCalledTimes(1);
      expect(mockClearStoredKey).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText("No recovery phrase active"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /lock vault/i }),
    ).not.toBeInTheDocument();
  });
});
