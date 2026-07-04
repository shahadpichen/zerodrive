import {
  arrayBufferToBase64,
  decryptSharedMetadata,
  encryptSharedMetadata,
} from "../../utils/fileSharing";

describe("shared metadata encryption", () => {
  it("round-trips metadata only with the recipient private key", async () => {
    const fileKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const recipient = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const wrappedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipient.publicKey,
      await crypto.subtle.exportKey("raw", fileKey),
    );
    const privateJwk = await crypto.subtle.exportKey(
      "jwk",
      recipient.privateKey,
    );
    const encrypted = await encryptSharedMetadata(
      {
        version: 1,
        name: "private-plan.pdf",
        mimeType: "application/pdf",
        message: "Confidential",
      },
      fileKey,
    );

    await expect(
      decryptSharedMetadata(
        encrypted,
        arrayBufferToBase64(wrappedKey),
        privateJwk,
      ),
    ).resolves.toEqual({
      version: 1,
      name: "private-plan.pdf",
      mimeType: "application/pdf",
      message: "Confidential",
    });
  });

  it("rejects tampered metadata", async () => {
    const fileKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const recipient = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const wrappedKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipient.publicKey,
      await crypto.subtle.exportKey("raw", fileKey),
    );
    const privateJwk = await crypto.subtle.exportKey(
      "jwk",
      recipient.privateKey,
    );
    const encrypted = new Uint8Array(
      Buffer.from(
        await encryptSharedMetadata(
          { version: 1, name: "a.txt", mimeType: "text/plain" },
          fileKey,
        ),
        "base64",
      ),
    );
    encrypted[encrypted.length - 1] ^= 1;

    await expect(
      decryptSharedMetadata(
        Buffer.from(encrypted).toString("base64"),
        arrayBufferToBase64(wrappedKey),
        privateJwk,
      ),
    ).rejects.toBeDefined();
  });
});
