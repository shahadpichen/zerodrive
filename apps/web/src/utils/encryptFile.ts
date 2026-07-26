import { createPersonalFileCapsule } from "./capsuleAdapter";

export const encryptFile = async (
  file: File,
  objectId = crypto.randomUUID(),
): Promise<Blob> => {
  const { encryptedBlob } = await createPersonalFileCapsule(file, objectId);
  return encryptedBlob;
};
