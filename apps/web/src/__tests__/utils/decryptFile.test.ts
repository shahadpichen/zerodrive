import { decryptFile } from "../../utils/decryptFile";
import { encryptFile } from "../../utils/encryptFile";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import { generateVaultRecoveryPhrase } from "../../utils/capsuleAdapter";

describe("decryptFile with Capsule v1", () => {
  const legacyRecoveryPhrase =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const legacyPersonalFileBase64 =
    "AAECAwQFBgcICQoLSgY+SADIxXyrQ5kz3Xa0MMYJEqYY4z55XcvEBwX3pJZ9isLWt073c+FwrrGoLu3LntG9I8+zBPhd";
  const legacyPersonalPlaintext =
    "ZeroDrive offline recovery compatibility\n";
  let recoveryPhrase: string;

  beforeEach(() => {
    sessionStorage.clear();
    recoveryPhrase = generateVaultRecoveryPhrase();
    setMnemonic(recoveryPhrase);
  });

  afterEach(() => {
    clearMnemonic();
  });

  it("round-trips text, MIME type, and binary data", async () => {
    const binary = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
    const file = new File([binary], "archive.bin", {
      type: "application/x-private-test",
    });

    const decrypted = await decryptFile(await encryptFile(file));

    expect(decrypted.mimeType).toBe("application/x-private-test");
    expect(
      new Uint8Array(await decrypted.contentBlob.arrayBuffer()),
    ).toEqual(binary);
  });

  it("rejects a different recovery phrase", async () => {
    const encrypted = await encryptFile(
      new File(["private"], "private.txt", { type: "text/plain" }),
    );
    setMnemonic(generateVaultRecoveryPhrase());

    await expect(decryptFile(encrypted)).rejects.toThrow(
      "recovery phrase cannot open",
    );
  });

  it("rejects tampered and truncated Capsules", async () => {
    const encrypted = await encryptFile(
      new File(["private"], "private.txt", { type: "text/plain" }),
    );
    const tampered = new Uint8Array(await encrypted.arrayBuffer());
    tampered[tampered.length - 1] ^= 1;

    await expect(decryptFile(new Blob([tampered]))).rejects.toThrow();
    await expect(
      decryptFile(new Blob([tampered.slice(0, 12)])),
    ).rejects.toThrow();
  });

  it("rejects a Capsule paired with a different vault-index entry", async () => {
    const firstObjectId = "1490c57e-f1e1-4c37-9477-e73de4fd11fd";
    const secondObjectId = "27375ac8-689e-46e4-8d2c-178776e5caa0";
    const encrypted = await encryptFile(
      new File(["first"], "first.txt", { type: "text/plain" }),
      firstObjectId,
    );

    await expect(
      decryptFile(encrypted, {
        name: "second.txt",
        mimeType: "text/plain",
        objectId: secondObjectId,
        revision: 1,
      }),
    ).rejects.toThrow("does not match its authenticated vault entry");
  });

  it("requires access after the phrase is cleared", async () => {
    const encrypted = await encryptFile(
      new File(["private"], "private.txt", { type: "text/plain" }),
    );
    clearMnemonic();

    await expect(decryptFile(encrypted)).rejects.toThrow();
  });

  it("opens the frozen production legacy personal-file format through Capsule", async () => {
    setMnemonic(legacyRecoveryPhrase);
    const encrypted = Uint8Array.from(
      atob(legacyPersonalFileBase64),
      (character) => character.charCodeAt(0),
    );

    const decrypted = await decryptFile(new Blob([encrypted]));

    await expect(decrypted.contentBlob.text()).resolves.toBe(
      legacyPersonalPlaintext,
    );
  });
});
