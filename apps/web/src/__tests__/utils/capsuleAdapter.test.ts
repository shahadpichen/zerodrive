import {
  CAPSULE_MAGIC,
  type JsonObject,
  type ZeroDriveSharedPrivateKey,
} from "@zerodrivehq/capsule";
import {
  createSharedFileCapsule,
  createSharedMetadataCapsule,
  createSharingKeyBackupCapsule,
  fingerprintSharingPublicKey,
  generateSharingRecipientKeyPair,
  generateVaultRecoveryPhrase,
  openSharedFileCapsule,
  openSharedMetadataCapsule,
  openSharingKeyBackupCapsule,
} from "../../utils/capsuleAdapter";
import {
  clearMnemonic,
  setMnemonic,
} from "../../utils/mnemonicManager";

function capsuleMagic(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) =>
    new TextDecoder().decode(new Uint8Array(buffer).slice(0, 4)),
  );
}

describe("ZeroDrive Capsule adapter", () => {
  let recoveryPhrase: string;

  beforeEach(() => {
    recoveryPhrase = generateVaultRecoveryPhrase();
    setMnemonic(recoveryPhrase);
  });

  afterEach(() => {
    clearMnemonic();
  });

  it("round-trips recipient-encrypted files and metadata Capsules", async () => {
    const keyPair = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      keyPair.publicKeyJwk,
    );
    const recipient = {
      publicKeyJwk: keyPair.publicKeyJwk as unknown as JsonObject,
      keyVersion: 7,
      fingerprint,
    };
    const privateKey: ZeroDriveSharedPrivateKey = {
      privateKeyJwk: keyPair.privateKeyJwk as unknown as JsonObject,
      keyVersion: 7,
    };
    const metadata: JsonObject = {
      version: 1,
      name: "合同-2026.pdf",
      mimeType: "application/pdf",
      message: "Private note 🔐",
    };
    const file = new File([new Uint8Array([0, 1, 255, 19])], "合同-2026.pdf", {
      type: "application/pdf",
    });

    const [fileCapsule, metadataCapsule] = await Promise.all([
      createSharedFileCapsule({
        file,
        recipients: [recipient],
        metadata,
      }),
      createSharedMetadataCapsule({
        recipients: [recipient],
        metadata,
      }),
    ]);

    await expect(capsuleMagic(fileCapsule.encryptedBlob)).resolves.toBe(
      CAPSULE_MAGIC,
    );
    expect(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(metadataCapsule.encryptedMetadata),
          (character) => character.charCodeAt(0),
        ).slice(0, 4),
      ),
    ).toBe(CAPSULE_MAGIC);

    const [openedFile, openedMetadata] = await Promise.all([
      openSharedFileCapsule({
        encryptedBlob: fileCapsule.encryptedBlob,
        recipientPrivateKeyJwks: [privateKey],
      }),
      openSharedMetadataCapsule({
        encryptedMetadata: metadataCapsule.encryptedMetadata,
        recipientPrivateKeyJwks: [privateKey],
      }),
    ]);

    expect(openedFile.contentFormat).toBe("capsule_v1");
    expect(openedMetadata.contentFormat).toBe("capsule_v1");
    expect(openedFile.metadata).toEqual(metadata);
    expect(openedMetadata.metadata).toEqual(metadata);
    expect(
      new Uint8Array(await openedFile.contentBlob.arrayBuffer()),
    ).toEqual(new Uint8Array([0, 1, 255, 19]));
  });

  it("fails closed for a non-recipient and tampered shared Capsule", async () => {
    const recipient = await generateSharingRecipientKeyPair();
    const stranger = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      recipient.publicKeyJwk,
    );
    const encrypted = await createSharedFileCapsule({
      file: new File(["private"], "private.txt", { type: "text/plain" }),
      recipients: [
        {
          publicKeyJwk: recipient.publicKeyJwk as unknown as JsonObject,
          keyVersion: 1,
          fingerprint,
        },
      ],
      metadata: {
        version: 1,
        name: "private.txt",
        mimeType: "text/plain",
      },
    });

    await expect(
      openSharedFileCapsule({
        encryptedBlob: encrypted.encryptedBlob,
        recipientPrivateKeyJwks: [
          {
            privateKeyJwk:
              stranger.privateKeyJwk as unknown as JsonObject,
            keyVersion: 1,
          },
        ],
      }),
    ).rejects.toThrow("sharing identity");

    const tampered = new Uint8Array(
      await encrypted.encryptedBlob.arrayBuffer(),
    );
    tampered[tampered.length - 1] ^= 1;
    await expect(
      openSharedFileCapsule({
        encryptedBlob: new Blob([tampered]),
        recipientPrivateKeyJwks: [
          {
            privateKeyJwk:
              recipient.privateKeyJwk as unknown as JsonObject,
            keyVersion: 1,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("round-trips sharing-key backups and rejects the wrong phrase", async () => {
    const keyPair = await generateSharingRecipientKeyPair();
    const fingerprint = await fingerprintSharingPublicKey(
      keyPair.publicKeyJwk,
    );
    const backup = await createSharingKeyBackupCapsule({
      ...keyPair,
      keyVersion: 9,
      fingerprint,
      recoveryPhrase,
    });

    await expect(capsuleMagic(backup)).resolves.toBe(CAPSULE_MAGIC);
    await expect(
      openSharingKeyBackupCapsule(backup, recoveryPhrase),
    ).resolves.toEqual(
      expect.objectContaining({
        privateKeyJwk: expect.objectContaining({ kty: "RSA" }),
        publicKeyJwk: expect.objectContaining({ kty: "RSA" }),
        keyVersion: 9,
        fingerprint,
        format: "capsule_v1",
      }),
    );

    await expect(
      openSharingKeyBackupCapsule(
        backup,
        generateVaultRecoveryPhrase(),
      ),
    ).rejects.toThrow();
  });
});
