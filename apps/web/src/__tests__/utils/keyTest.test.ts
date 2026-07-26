import { testEncryptionKey } from "../../utils/keyTest";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import { generateVaultRecoveryPhrase } from "../../utils/capsuleAdapter";

describe("testEncryptionKey", () => {
  afterEach(() => {
    clearMnemonic();
  });

  it("verifies the active phrase through a Capsule v1 round trip", async () => {
    setMnemonic(generateVaultRecoveryPhrase());

    await expect(testEncryptionKey()).resolves.toEqual({
      success: true,
      message: "Your recovery phrase can open Capsule v1 files.",
    });
  });

  it("requires a phrase in this browser tab", async () => {
    await expect(testEncryptionKey()).resolves.toEqual({
      success: false,
      message: "No recovery phrase is active in this browser tab.",
    });
  });

  it("does not clear or replace the active phrase", async () => {
    const phrase = generateVaultRecoveryPhrase();
    setMnemonic(phrase);

    await testEncryptionKey();
    await expect(testEncryptionKey()).resolves.toMatchObject({ success: true });
  });
});
