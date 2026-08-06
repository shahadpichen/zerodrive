import { CAPSULE_MAGIC } from "@zerodrivehq/capsule";
import {
  decryptMetadata,
  encryptMetadata,
} from "../../utils/metadataEncryption";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";
import { generateVaultRecoveryPhrase } from "../../utils/capsuleAdapter";

const LEGACY_RECOVERY_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const LEGACY_VAULT_INDEX_BASE64 =
  "MDEyMzQ1Njc4OTo7yeW4ZkCA8H+FMbd3hNJrSaiLLIE8N1Kg3F1yPSN5q0me7UV4VIcy/EiJyMhjU5rvprzJTj2PsezHZqPN1ialnHGbLTVlaedQ3DocUoE2mB04NHy4lB+3vx5tA+XLcx6IQbT2x9WLv85G8x0=";
const LEGACY_VAULT_INDEX = {
  files: [
    {
      id: "legacy-file",
      name: "old.txt",
      size: 3,
      type: "text/plain",
    },
  ],
  folders: [],
};

describe("vault-index Capsule encryption", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setMnemonic(generateVaultRecoveryPhrase());
  });

  afterEach(() => {
    clearMnemonic();
  });

  it.each([
    ["empty", {}],
    [
      "nested",
      {
        files: [
          {
            id: "drive-object",
            name: "秘密-plan.pdf",
            mimeType: "application/pdf",
          },
        ],
        folders: [{ id: "folder-1", name: "工作", parentId: null }],
      },
    ],
    [
      "typed",
      {
        string: "text",
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: "value" },
        nullable: null,
      },
    ],
  ])("round-trips %s vault indexes", async (_label, index) => {
    const encrypted = await encryptMetadata(index);
    const bytes = new Uint8Array(await encrypted.arrayBuffer());

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe(CAPSULE_MAGIC);
    await expect(decryptMetadata(encrypted)).resolves.toEqual(index);
  });

  it("uses fresh authenticated encryption and detects tampering", async () => {
    const index = { files: [{ id: "one", name: "one.txt" }] };
    const [first, second] = await Promise.all([
      encryptMetadata(index),
      encryptMetadata(index),
    ]);
    expect(new Uint8Array(await first.arrayBuffer())).not.toEqual(
      new Uint8Array(await second.arrayBuffer()),
    );

    const tampered = new Uint8Array(await first.arrayBuffer());
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptMetadata(new Blob([tampered]))).rejects.toThrow();
  });

  it("fails closed when the recovery phrase is unavailable or incorrect", async () => {
    const encrypted = await encryptMetadata({ private: true });
    clearMnemonic();
    await expect(decryptMetadata(encrypted)).rejects.toThrow();

    setMnemonic(generateVaultRecoveryPhrase());
    await expect(decryptMetadata(encrypted)).rejects.toThrow();
  });

  it("opens the frozen production legacy vault-index format through Capsule", async () => {
    setMnemonic(LEGACY_RECOVERY_PHRASE);
    const encrypted = Uint8Array.from(
      atob(LEGACY_VAULT_INDEX_BASE64),
      (character) => character.charCodeAt(0),
    );

    await expect(decryptMetadata(new Blob([encrypted]))).resolves.toEqual(
      LEGACY_VAULT_INDEX,
    );
  });
});
