import { createVaultIndexCapsule } from "./capsuleAdapter";
import { getGoogleAccessToken } from "./gapiInit";

const capabilityFileName = (shareId: string) =>
  `zerodrive_share_${shareId}.cap`;

export async function storeShareManagementCapability(
  shareId: string,
  capability: string,
): Promise<void> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error("Cannot back up the share management capability");
  }

  const { encryptedBlob } = await createVaultIndexCapsule({
    version: 1,
    kind: "share_management_capability",
    shareId,
    capability,
  });

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
  form.append("file", encryptedBlob);

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
