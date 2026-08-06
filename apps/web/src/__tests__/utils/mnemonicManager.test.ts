import {
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import {
  getRememberedVaultMetadataStatus,
  rememberVaultMetadataStatus,
} from "../../utils/vaultMetadataWriteGuard";

describe("mnemonicManager vault verification safety", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    clearMnemonic();
  });

  it("invalidates remembered metadata verification when a phrase is set", () => {
    rememberVaultMetadataStatus("user@example.com", "ready");

    setMnemonic("example recovery phrase");

    expect(
      getRememberedVaultMetadataStatus("user@example.com"),
    ).toBe("unverified");
  });

  it("invalidates remembered metadata verification when access is cleared", () => {
    rememberVaultMetadataStatus("user@example.com", "ready");

    clearMnemonic();

    expect(
      getRememberedVaultMetadataStatus("user@example.com"),
    ).toBe("unverified");
  });

  it("invalidates an in-flight recovery phrase session", () => {
    setMnemonic("first recovery phrase");
    const session = captureActiveRecoveryPhraseSession();

    setMnemonic("second recovery phrase");

    expect(() => assertRecoveryPhraseSessionCurrent(session)).toThrow(
      "Recovery & Access changed while ZeroDrive was working",
    );
  });
});
