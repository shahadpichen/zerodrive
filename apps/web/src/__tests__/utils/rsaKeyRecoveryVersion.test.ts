import { recoverRsaKeyVersion } from "../../utils/rsaKeyRecovery";
import { downloadEncryptedRsaKeyFromDrive } from "../../utils/gdriveKeyStorage";
import { decryptRsaPrivateKeyWithAesKey } from "../../utils/rsaKeyManager";
import { getStoredKey } from "../../utils/cryptoUtils";
import { storeUserKeyPair } from "../../utils/keyStorage";

jest.mock("sonner", () => ({ toast: {} }));
jest.mock("../../utils/gdriveKeyStorage");
jest.mock("../../utils/rsaKeyManager");
jest.mock("../../utils/cryptoUtils");
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
  });

  it("downloads, decrypts, and stores the requested historical key version", async () => {
    const aesKey = {} as CryptoKey;
    const encryptedBackup = new Blob(["encrypted"]);
    const privateKeyJwk: JsonWebKey = {
      kty: "RSA",
      n: "modulus",
      e: "AQAB",
      d: "private-exponent",
      key_ops: ["decrypt"],
    };

    (getStoredKey as jest.Mock).mockResolvedValue(aesKey);
    (downloadEncryptedRsaKeyFromDrive as jest.Mock).mockResolvedValue(
      encryptedBackup,
    );
    (decryptRsaPrivateKeyWithAesKey as jest.Mock).mockResolvedValue(
      privateKeyJwk,
    );

    const result = await recoverRsaKeyVersion(
      "user@example.com",
      3,
      "recovery phrase",
    );

    expect(downloadEncryptedRsaKeyFromDrive).toHaveBeenCalledWith(3);
    expect(decryptRsaPrivateKeyWithAesKey).toHaveBeenCalledWith(
      encryptedBackup,
      aesKey,
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
    );
    expect(result?.publicKeyJwk.n).toBe("modulus");
  });

  it("does not attempt recovery without the primary AES key", async () => {
    (getStoredKey as jest.Mock).mockResolvedValue(null);

    await expect(
      recoverRsaKeyVersion("user@example.com", 2, "recovery phrase"),
    ).resolves.toBeNull();
    expect(downloadEncryptedRsaKeyFromDrive).not.toHaveBeenCalled();
  });
});
