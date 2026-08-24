import {
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
  clearMnemonic,
  getMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import {
  getRememberedVaultMetadataStatus,
  rememberVaultMetadataStatus,
} from "../../utils/vaultMetadataWriteGuard";

describe("mnemonicManager vault verification safety", () => {
  const phraseSessionKey = "zerodrive-recovery-phrase-tab-session";

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

  it("restores the recovery phrase across a reload in the same account tab", () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "USER@example.com" }),
    );
    sessionStorage.setItem(
      phraseSessionKey,
      JSON.stringify({
        version: 1,
        userEmail: "user@example.com",
        phrase: "tab scoped recovery phrase",
      }),
    );

    expect(getMnemonic()).toBe("tab scoped recovery phrase");
  });

  it("persists a newly activated phrase only for the current account", () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "user@example.com" }),
    );

    setMnemonic("current account recovery phrase");

    expect(JSON.parse(sessionStorage.getItem(phraseSessionKey) ?? "{}")).toEqual(
      {
        version: 1,
        userEmail: "user@example.com",
        phrase: "current account recovery phrase",
      },
    );
  });

  it("discards a tab-session phrase when the account changes", () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "first@example.com" }),
    );
    setMnemonic("first account recovery phrase");
    const activeSession = captureActiveRecoveryPhraseSession();

    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({ userEmail: "second@example.com" }),
    );

    expect(getMnemonic()).toBeNull();
    expect(sessionStorage.getItem(phraseSessionKey)).toBeNull();
    expect(() => assertRecoveryPhraseSessionCurrent(activeSession)).toThrow(
      "Recovery & Access changed while ZeroDrive was working",
    );
    expect(
      getRememberedVaultMetadataStatus("first@example.com"),
    ).toBe("unverified");
  });

  it("does not persist a phrase before an account session is known", () => {
    setMnemonic("memory only recovery phrase");

    expect(getMnemonic()).toBe("memory only recovery phrase");
    expect(sessionStorage.getItem(phraseSessionKey)).toBeNull();
  });
});
