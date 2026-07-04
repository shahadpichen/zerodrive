export interface SharedKeyEnvelopeV1 {
  v: 1;
  keyWrap: "RSA-OAEP-256";
  contentEncryption: "AES-256-GCM";
  ciphertext: string;
}

export function serializeSharedKeyEnvelope(ciphertext: string): string {
  const envelope: SharedKeyEnvelopeV1 = {
    v: 1,
    keyWrap: "RSA-OAEP-256",
    contentEncryption: "AES-256-GCM",
    ciphertext,
  };
  return JSON.stringify(envelope);
}

/**
 * Returns wrapped key bytes as base64. Existing shares used raw base64 or
 * PostgreSQL bytea hex, so reads remain backward compatible.
 */
export function readSharedKeyCiphertext(value: string): string {
  if (value.startsWith("\\x")) {
    const hex = value.slice(2);
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
      throw new Error("Legacy wrapped file key is malformed");
    }
    const bytes = new Uint8Array(hex.length / 2);
    let binary = "";
    for (let index = 0; index < hex.length; index += 2) {
      const byte = Number.parseInt(hex.slice(index, index + 2), 16);
      bytes[index / 2] = byte;
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  if (!value.trim().startsWith("{")) return value;

  let envelope: Partial<SharedKeyEnvelopeV1>;
  try {
    envelope = JSON.parse(value);
  } catch {
    throw new Error("Wrapped file key envelope is malformed");
  }
  if (
    envelope.v !== 1 ||
    envelope.keyWrap !== "RSA-OAEP-256" ||
    envelope.contentEncryption !== "AES-256-GCM" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Wrapped file key envelope is unsupported");
  }
  return envelope.ciphertext;
}
