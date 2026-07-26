import logger from "./logger";
import {
  openPersonalFileCapsule,
  type CapsuleContentFormat,
} from "./capsuleAdapter";

export interface PersonalFileIdentity {
  name?: string;
  mimeType?: string;
  objectId?: string;
  revision?: number;
}

export interface DecryptedPersonalFile {
  contentBlob: Blob;
  fileName: string;
  mimeType: string;
  objectId?: string;
  revision?: number;
  contentFormat: CapsuleContentFormat;
}

export const decryptFile = async (
  fileBlob: Blob,
  expected: PersonalFileIdentity = {},
): Promise<DecryptedPersonalFile> => {
  try {
    const opened = await openPersonalFileCapsule(fileBlob);
    const metadata = opened.metadata;
    const fileName =
      typeof metadata.name === "string"
        ? metadata.name
        : expected.name || "decrypted-file";
    const mimeType =
      typeof metadata.mimeType === "string"
        ? metadata.mimeType
        : expected.mimeType || "application/octet-stream";
    const objectId =
      typeof metadata.objectId === "string" ? metadata.objectId : undefined;
    const revision =
      typeof metadata.revision === "number" ? metadata.revision : undefined;

    if (opened.contentFormat === "capsule_v1") {
      const size =
        typeof metadata.size === "number" ? metadata.size : undefined;
      const identityMismatch =
        (expected.name !== undefined && expected.name !== fileName) ||
        (expected.mimeType !== undefined &&
          (expected.mimeType || "application/octet-stream") !== mimeType) ||
        (expected.objectId !== undefined &&
          expected.objectId !== objectId) ||
        (expected.revision !== undefined &&
          expected.revision !== revision) ||
        (size !== undefined && size !== opened.contentBlob.size);
      if (identityMismatch) {
        throw new Error(
          "The encrypted file does not match its authenticated vault entry.",
        );
      }
    }

    return {
      contentBlob: opened.contentBlob,
      fileName,
      mimeType,
      objectId,
      revision,
      contentFormat: opened.contentFormat,
    };
  } catch (error) {
    logger.error("Decryption error:", error);
    throw error;
  }
};
