import type {
  JsonObject,
  ZeroDriveSharedPrivateKey,
} from "@zerodrivehq/capsule";
import {
  decryptSharedFile,
  decryptSharedMetadata,
  prepareFileForSharing,
} from "../../utils/fileSharing";
import {
  fingerprintSharingPublicKey,
  generateSharingRecipientKeyPair,
} from "../../utils/capsuleAdapter";

describe("shared-file Capsule binding", () => {
  it("binds the inbox metadata Capsule to the downloaded file Capsule", async () => {
    const recipient = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      recipient.publicKeyJwk,
    );
    const recipientPrivateKey: ZeroDriveSharedPrivateKey = {
      privateKeyJwk:
        recipient.privateKeyJwk as unknown as JsonObject,
      keyVersion: 4,
    };
    const prepared = await prepareFileForSharing(
      new File(["private report"], "report.txt", { type: "text/plain" }),
      "recipient@example.com",
      "For your review",
      {
        public_key: JSON.stringify(recipient.publicKeyJwk),
        key_version: 4,
        fingerprint,
      },
    );
    const metadata = await decryptSharedMetadata({
      encryptedMetadata: prepared.encryptedMetadata,
      contentFormat: "capsule_v1",
      recipientPrivateKeys: [recipientPrivateKey],
    });

    expect(metadata.bindingId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await expect(
      decryptSharedFile({
        encryptedFileBlob: prepared.encryptedFileBlob,
        contentFormat: "capsule_v1",
        recipientPrivateKeys: [recipientPrivateKey],
        fallbackName: "encrypted.zd",
        fallbackMimeType: "application/octet-stream",
        expectedBindingId: metadata.bindingId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        fileName: "report.txt",
        mimeType: "text/plain",
      }),
    );

    await expect(
      decryptSharedFile({
        encryptedFileBlob: prepared.encryptedFileBlob,
        contentFormat: "capsule_v1",
        recipientPrivateKeys: [recipientPrivateKey],
        fallbackName: "encrypted.zd",
        fallbackMimeType: "application/octet-stream",
        expectedBindingId: "27375ac8-689e-46e4-8d2c-178776e5caa0",
      }),
    ).rejects.toThrow("does not match its authenticated inbox details");

    await expect(
      decryptSharedMetadata({
        encryptedMetadata: prepared.encryptedMetadata,
        encryptedFileKey: "{}",
        contentFormat: "legacy_zdse",
        recipientPrivateKeys: [recipientPrivateKey],
      }),
    ).rejects.toThrow(
      "encrypted metadata format does not match its inbox record",
    );

    await expect(
      decryptSharedFile({
        encryptedFileBlob: prepared.encryptedFileBlob,
        encryptedFileKey: "{}",
        contentFormat: "legacy_zdse",
        recipientPrivateKeys: [recipientPrivateKey],
        fallbackName: "encrypted.zd",
        fallbackMimeType: "application/octet-stream",
      }),
    ).rejects.toThrow(
      "encrypted file format does not match its inbox record",
    );
  });
});
