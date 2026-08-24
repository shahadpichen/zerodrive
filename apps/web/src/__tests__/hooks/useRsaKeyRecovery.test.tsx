import { act, renderHook } from "@testing-library/react";
import { useRsaKeyRecovery } from "../../hooks/useRsaKeyRecovery";
import { getAuthenticatedUser } from "../../utils/authService";
import { hasMnemonic } from "../../utils/mnemonicManager";
import { recoverRsaKeysIfNeeded } from "../../utils/rsaKeyRecovery";

jest.mock("../../utils/authService", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  hasMnemonic: jest.fn(),
}));

jest.mock("../../utils/rsaKeyRecovery", () => ({
  recoverRsaKeysIfNeeded: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<
  typeof getAuthenticatedUser
>;
const mockHasMnemonic = hasMnemonic as jest.MockedFunction<typeof hasMnemonic>;
const mockRecoverRsaKeysIfNeeded =
  recoverRsaKeysIfNeeded as jest.MockedFunction<typeof recoverRsaKeysIfNeeded>;

describe("useRsaKeyRecovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockHasMnemonic.mockReturnValue(true);
    mockRecoverRsaKeysIfNeeded.mockResolvedValue({
      success: true,
      recovered: false,
      keysExisted: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("binds the backend-authenticated account before restoring the tab phrase", async () => {
    let resolveUser!: (
      value: Awaited<ReturnType<typeof getAuthenticatedUser>>,
    ) => void;
    mockGetAuthenticatedUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );

    renderHook(() => useRsaKeyRecovery());

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockGetAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(mockHasMnemonic).not.toHaveBeenCalled();
    expect(mockRecoverRsaKeysIfNeeded).not.toHaveBeenCalled();

    await act(async () => {
      resolveUser({
        email: "person@example.com",
        emailHash: "a".repeat(64),
        capabilities: { analyticsRead: false },
      });
      await Promise.resolve();
    });

    expect(mockHasMnemonic).toHaveBeenCalledTimes(1);
    expect(mockRecoverRsaKeysIfNeeded).toHaveBeenCalledWith(
      "person@example.com",
    );
  });

  it("does not restore or use a phrase when backend authentication is absent", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    renderHook(() => useRsaKeyRecovery());

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(mockHasMnemonic).not.toHaveBeenCalled();
    expect(mockRecoverRsaKeysIfNeeded).not.toHaveBeenCalled();
  });
});
