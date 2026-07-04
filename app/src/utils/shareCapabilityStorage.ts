import { getStoredKey } from "./cryptoUtils";
import { getGoogleAccessToken } from "./gapiInit";

const capabilityFileName = (shareId: string) =>
  `zerodrive_share_${shareId}.cap`;

export async function storeShareManagementCapability(
  shareId: string,
  capability: string,
): Promise<void> {
  const [key, token] = await Promise.all([
    getStoredKey(),
    getGoogleAccessToken(),
  ]);
  if (!key || !token) {
    throw new Error("Cannot back up the share management capability");
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ version: 1, shareId, capability }),
  );
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(shareId),
    },
    key,
    plaintext,
  );
  const encrypted = new Uint8Array(iv.length + ciphertext.byteLength);
  encrypted.set(iv);
  encrypted.set(new Uint8Array(ciphertext), iv.length);

  const metadata = {
    name: capabilityFileName(shareId),
    mimeType: "application/octet-stream",
    parents: ["appDataFolder"],
  };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", new Blob([encrypted]));

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  if (!response.ok) {
    throw new Error("Failed to back up the share management capability");
  }
}
