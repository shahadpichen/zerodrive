import type {
  JsonObject,
  ZeroDriveSharedPrivateKey,
} from "@zerodrivehq/capsule";
import {
  createSharedMetadataCapsule,
  fingerprintSharingPublicKey,
  generateSharingRecipientKeyPair,
} from "../../utils/capsuleAdapter";
import { decryptSharedMetadata } from "../../utils/fileSharing";

const metadata: JsonObject = {
  version: 1,
  bindingId: "1490c57e-f1e1-4c37-9477-e73de4fd11fd",
  name: "private-plan.pdf",
  mimeType: "application/pdf",
  message: "Confidential",
};

function privateKeyCandidate(
  privateKeyJwk: JsonWebKey,
  keyVersion: number,
): ZeroDriveSharedPrivateKey {
  return {
    privateKeyJwk: privateKeyJwk as unknown as JsonObject,
    keyVersion,
  };
}

describe("shared metadata Capsule encryption", () => {
  it("round-trips metadata only with the recipient private key", async () => {
    const recipient = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      recipient.publicKeyJwk,
    );
    const encrypted = await createSharedMetadataCapsule({
      metadata,
      recipients: [
        {
          publicKeyJwk: recipient.publicKeyJwk as unknown as JsonObject,
          keyVersion: 1,
          fingerprint,
        },
      ],
    });

    await expect(
      decryptSharedMetadata({
        encryptedMetadata: encrypted.encryptedMetadata,
        contentFormat: "capsule_v1",
        recipientPrivateKeys: [
          privateKeyCandidate(recipient.privateKeyJwk, 1),
        ],
      }),
    ).resolves.toEqual(metadata);
  });

  it("rejects tampered metadata", async () => {
    const recipient = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      recipient.publicKeyJwk,
    );
    const encrypted = await createSharedMetadataCapsule({
      metadata,
      recipients: [
        {
          publicKeyJwk: recipient.publicKeyJwk as unknown as JsonObject,
          keyVersion: 2,
          fingerprint,
        },
      ],
    });
    const bytes = Uint8Array.from(
      atob(encrypted.encryptedMetadata),
      (character) => character.charCodeAt(0),
    );
    bytes[bytes.length - 1] ^= 1;
    const tampered = btoa(
      Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
    );

    await expect(
      decryptSharedMetadata({
        encryptedMetadata: tampered,
        contentFormat: "capsule_v1",
        recipientPrivateKeys: [
          privateKeyCandidate(recipient.privateKeyJwk, 2),
        ],
      }),
    ).rejects.toBeDefined();
  });
});
