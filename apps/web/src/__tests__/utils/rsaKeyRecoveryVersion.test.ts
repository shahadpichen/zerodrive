import { recoverRsaKeyVersion } from "../../utils/rsaKeyRecovery";
import { downloadEncryptedRsaKeyFromDrive } from "../../utils/gdriveKeyStorage";
import { storeUserKeyPair } from "../../utils/keyStorage";
import {
  fingerprintSharingPublicKey,
  openSharingKeyBackupCapsule,
} from "../../utils/capsuleAdapter";

jest.mock("sonner", () => ({ toast: {} }));
jest.mock("../../utils/gdriveKeyStorage");
jest.mock("../../utils/capsuleAdapter", () => ({
  fingerprintSharingPublicKey: jest.fn(),
  openSharingKeyBackupCapsule: jest.fn(),
}));
jest.mock("../../utils/keyStorage", () => ({
  userHasStoredKeys: jest.fn(),
  storeUserKeyPair: jest.fn(),
}));
jest.mock("../../utils/fileSharing", () => ({
  storeUserPublicKey: jest.fn(),
}));
jest.mock("../../utils/mnemonicManager", () => ({
  getMnemonic: jest.fn(),
}));
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("recoverRsaKeyVersion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fingerprintSharingPublicKey as jest.Mock).mockResolvedValue(
      "a".repeat(64),
    );
  });

  it("downloads, decrypts, and stores the requested historical key version", async () => {
    const encryptedBackup = new Blob(["encrypted"]);
    const privateKeyJwk: JsonWebKey = {
      kty: "RSA",
      n: "modulus",
      e: "AQAB",
      d: "private-exponent",
      key_ops: ["decrypt"],
    };

    (downloadEncryptedRsaKeyFromDrive as jest.Mock).mockResolvedValue(
      encryptedBackup,
    );
    (openSharingKeyBackupCapsule as jest.Mock).mockResolvedValue({
      privateKeyJwk,
      keyVersion: 3,
      fingerprint: "a".repeat(64),
      format: "capsule_v1",
    });

    const result = await recoverRsaKeyVersion(
      "user@example.com",
      3,
      "recovery phrase",
    );

    expect(downloadEncryptedRsaKeyFromDrive).toHaveBeenCalledWith(3);
    expect(openSharingKeyBackupCapsule).toHaveBeenCalledWith(
      encryptedBackup,
      "recovery phrase",
      { legacyKeyVersion: 3 },
    );
    expect(storeUserKeyPair).toHaveBeenCalledWith(
      "user@example.com",
      {
        publicKeyJwk: {
          kty: "RSA",
          n: "modulus",
          e: "AQAB",
          alg: "RSA-OAEP-256",
          key_ops: ["encrypt"],
          ext: true,
        },
        privateKeyJwk,
      },
      "recovery phrase",
      3,
      { makeCurrent: false },
    );
    expect(result?.publicKeyJwk.n).toBe("modulus");
  });

  it("rejects a historical backup whose authenticated fingerprint is wrong", async () => {
    (downloadEncryptedRsaKeyFromDrive as jest.Mock).mockResolvedValue(
      new Blob(["encrypted"]),
    );
    (openSharingKeyBackupCapsule as jest.Mock).mockResolvedValue({
      privateKeyJwk: {
        kty: "RSA",
        n: "modulus",
        e: "AQAB",
        d: "private-exponent",
      },
      keyVersion: 3,
      fingerprint: "b".repeat(64),
      format: "capsule_v1",
    });

    await expect(
      recoverRsaKeyVersion(
        "user@example.com",
        3,
        "recovery phrase",
        "a".repeat(64),
      ),
    ).resolves.toBeNull();
    expect(storeUserKeyPair).not.toHaveBeenCalled();
  });

  it("returns null when the requested backup cannot be opened", async () => {
    (downloadEncryptedRsaKeyFromDrive as jest.Mock).mockResolvedValue(
      new Blob(["encrypted"]),
    );
    (openSharingKeyBackupCapsule as jest.Mock).mockRejectedValue(
      new Error("No matching backup"),
    );

    await expect(
      recoverRsaKeyVersion("user@example.com", 2, "recovery phrase"),
    ).resolves.toBeNull();
    expect(storeUserKeyPair).not.toHaveBeenCalled();
  });
});
