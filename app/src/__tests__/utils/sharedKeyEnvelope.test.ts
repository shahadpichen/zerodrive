import {
  readSharedKeyCiphertext,
  serializeSharedKeyEnvelope,
} from "../../utils/sharedKeyEnvelope";

describe("shared key envelopes", () => {
  it("serializes and reads the supported cryptographic suite", () => {
    const ciphertext = btoa("wrapped-key");
    const serialized = serializeSharedKeyEnvelope(ciphertext);

    expect(JSON.parse(serialized)).toEqual({
      v: 1,
      keyWrap: "RSA-OAEP-256",
      contentEncryption: "AES-256-GCM",
      ciphertext,
    });
    expect(readSharedKeyCiphertext(serialized)).toBe(ciphertext);
  });

  it("continues to read legacy bytea hex shares", () => {
    expect(readSharedKeyCiphertext("\\x0102ff")).toBe("AQL/");
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
