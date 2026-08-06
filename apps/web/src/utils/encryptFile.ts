import { createPersonalFileCapsule } from "./capsuleAdapter";

export const encryptFile = async (
  file: File,
  objectId = crypto.randomUUID(),
  recoveryPhrase?: string,
): Promise<Blob> => {
  const { encryptedBlob } = await createPersonalFileCapsule(
    file,
    objectId,
    recoveryPhrase,
  );
  return encryptedBlob;
};
