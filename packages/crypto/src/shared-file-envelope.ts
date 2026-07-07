import type { SharedFileMetadata } from "@zerodrive/shared-types";

const MAGIC = new Uint8Array([0x5a, 0x44, 0x53, 0x45]); // ZDSE
const VERSION = 1;
const ALGORITHM_AES_256_GCM = 1;
const HEADER_LENGTH = 42;

export interface DecryptedSharedEnvelope {
  metadata: SharedFileMetadata;
  plaintext: ArrayBuffer;
}

function hasMagic(bytes: Uint8Array): boolean {
  return MAGIC.every((value, index) => bytes[index] === value);
}

export async function createSharedFileEnvelope(
  plaintext: ArrayBuffer,
  metadata: SharedFileMetadata,
  key: CryptoKey,
  recipientKeyVersion: number,
): Promise<Blob> {
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const metadataIv = crypto.getRandomValues(new Uint8Array(12));
  const fileIv = crypto.getRandomValues(new Uint8Array(12));
  const metadataCipherLength = metadataBytes.byteLength + 16;
  const fileCipherLength = plaintext.byteLength + 16;
  const header = new Uint8Array(HEADER_LENGTH);
  header.set(MAGIC, 0);
  const view = new DataView(header.buffer);
  view.setUint8(4, VERSION);
  view.setUint8(5, ALGORITHM_AES_256_GCM);
  view.setUint32(6, recipientKeyVersion);
  header.set(metadataIv, 10);
  header.set(fileIv, 22);
  view.setUint32(34, metadataCipherLength);
  view.setUint32(38, fileCipherLength);

  const [encryptedMetadata, encryptedFile] = await Promise.all([
    crypto.subtle.encrypt(
      { name: "AES-GCM", iv: metadataIv, additionalData: header },
      key,
      metadataBytes,
    ),
    crypto.subtle.encrypt(
      { name: "AES-GCM", iv: fileIv, additionalData: header },
      key,
      plaintext,
    ),
  ]);
  return new Blob([header, encryptedMetadata, encryptedFile], {
    type: "application/octet-stream",
  });
}

export async function decryptSharedFileEnvelope(
  encrypted: ArrayBuffer,
  key: CryptoKey,
): Promise<DecryptedSharedEnvelope | null> {
  const bytes = new Uint8Array(encrypted);
  if (!hasMagic(bytes)) return null;
  if (bytes.byteLength < HEADER_LENGTH) {
    throw new Error("Encrypted file envelope is truncated");
  }
  const header = bytes.slice(0, HEADER_LENGTH);
  const view = new DataView(header.buffer);
  if (view.getUint8(4) !== VERSION) {
    throw new Error("Encrypted file envelope version is unsupported");
  }
  if (view.getUint8(5) !== ALGORITHM_AES_256_GCM) {
    throw new Error("Encrypted file algorithm is unsupported");
  }
  const metadataLength = view.getUint32(34);
  const fileLength = view.getUint32(38);
  if (
    metadataLength < 17 ||
    fileLength < 17 ||
    HEADER_LENGTH + metadataLength + fileLength !== bytes.byteLength
  ) {
    throw new Error("Encrypted file envelope lengths are malformed");
  }

  const metadataCiphertext = bytes.slice(
    HEADER_LENGTH,
    HEADER_LENGTH + metadataLength,
  );
  const fileCiphertext = bytes.slice(HEADER_LENGTH + metadataLength);
  const [metadataPlaintext, plaintext] = await Promise.all([
    crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: header.slice(10, 22),
        additionalData: header,
      },
      key,
      metadataCiphertext,
    ),
    crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: header.slice(22, 34),
        additionalData: header,
      },
      key,
      fileCiphertext,
    ),
  ]);
  const metadata = JSON.parse(
    new TextDecoder().decode(metadataPlaintext),
  ) as SharedFileMetadata;
  if (
    metadata.version !== 1 ||
    typeof metadata.name !== "string" ||
    typeof metadata.mimeType !== "string"
  ) {
    throw new Error("Encrypted file metadata is malformed");
  }
  return { metadata, plaintext };
}
