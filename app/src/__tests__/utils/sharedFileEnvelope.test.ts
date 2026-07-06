import {
  createSharedFileEnvelope,
  decryptSharedFileEnvelope,
} from "../../utils/sharedFileEnvelope";

describe("authenticated shared file envelope", () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  });

  async function envelopeBytes() {
    const blob = await createSharedFileEnvelope(
      new TextEncoder().encode("secret file").buffer,
      {
        version: 1,
        name: "secret.txt",
        mimeType: "text/plain",
        message: "private message",
      },
      key,
      4,
    );
    return new Uint8Array(await blob.arrayBuffer());
  }

  it("authenticates and decrypts file content and private metadata", async () => {
    const bytes = await envelopeBytes();
    const result = await decryptSharedFileEnvelope(bytes.buffer, key);

    expect(new TextDecoder().decode(result!.plaintext)).toBe("secret file");
    expect(result!.metadata).toEqual({
      version: 1,
      name: "secret.txt",
      mimeType: "text/plain",
      message: "private message",
    });
  });

  it("rejects header and ciphertext tampering", async () => {
    const headerTampered = await envelopeBytes();
    headerTampered[6] ^= 1;
    await expect(
      decryptSharedFileEnvelope(headerTampered.buffer, key),
    ).rejects.toThrow();

    const ciphertextTampered = await envelopeBytes();
    ciphertextTampered[ciphertextTampered.length - 1] ^= 1;
    await expect(
      decryptSharedFileEnvelope(ciphertextTampered.buffer, key),
    ).rejects.toThrow();
  });

  it("rejects truncation and unknown versions", async () => {
    const truncated = (await envelopeBytes()).slice(0, -1);
    await expect(
      decryptSharedFileEnvelope(truncated.buffer, key),
    ).rejects.toThrow("lengths");

    const unknown = await envelopeBytes();
    unknown[4] = 9;
    await expect(
      decryptSharedFileEnvelope(unknown.buffer, key),
    ).rejects.toThrow("version");
  });

  it("identifies legacy version-zero ciphertext for the legacy reader", async () => {
    const legacy = crypto.getRandomValues(new Uint8Array(64));
    await expect(
      decryptSharedFileEnvelope(legacy.buffer, key),
    ).resolves.toBeNull();
  });
});
