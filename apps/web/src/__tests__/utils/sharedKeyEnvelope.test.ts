import {
  readRecipientKeyVersion,
  readSharedKeyCiphertext,
  serializeSharedKeyEnvelope,
} from "@zerodrive/crypto";

describe("shared key envelopes", () => {
  it("serializes and reads the supported cryptographic suite", () => {
    const ciphertext = btoa("wrapped-key");
    const serialized = serializeSharedKeyEnvelope(
      ciphertext,
      3,
      "a".repeat(64),
    );

    expect(JSON.parse(serialized)).toEqual({
      v: 2,
      keyWrap: "RSA-OAEP-256",
      contentEncryption: "AES-256-GCM",
      recipientKeyVersion: 3,
      recipientKeyFingerprint: "a".repeat(64),
      ciphertext,
    });
    expect(readSharedKeyCiphertext(serialized)).toBe(ciphertext);
    expect(readRecipientKeyVersion(serialized)).toBe(3);
  });

  it("continues to read legacy bytea hex shares", () => {
    expect(readSharedKeyCiphertext("\\x0102ff")).toBe("AQL/");
    expect(readRecipientKeyVersion("\\x0102ff")).toBeNull();
  });

  it("rejects unknown algorithms instead of silently guessing", () => {
    expect(() =>
      readSharedKeyCiphertext(
        JSON.stringify({
          v: 1,
          keyWrap: "RSA-OAEP",
          contentEncryption: "AES-256-GCM",
          ciphertext: "AA==",
        }),
      ),
    ).toThrow("unsupported");
  });
});
