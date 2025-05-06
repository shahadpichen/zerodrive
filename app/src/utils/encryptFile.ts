import { getStoredKey } from "./cryptoUtils";

export const encryptFile = async (file: File): Promise<Blob> => {
  const key = await getStoredKey();
  if (!key) throw new Error("No encryption key found.");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileArrayBuffer
  );

  const encryptedArray = new Uint8Array(
    iv.byteLength + encryptedBuffer.byteLength
  );
  encryptedArray.set(new Uint8Array(iv), 0);
  encryptedArray.set(new Uint8Array(encryptedBuffer), iv.byteLength);

  return new Blob([encryptedArray], { type: file.type });
};
