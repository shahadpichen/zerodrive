export interface EphemeralKey {
  privateKey: bigint;
  publicKey: bigint;
  salt: bigint;
  expiry: Date;
  ephemeralPubkeyHash: bigint;
}

export const LocalStorageKeys = {
  EphemeralKey: "ephemeralKey",
  CurrentGroupId: "currentGroupId",
  CurrentProvider: "currentProvider",
  GoogleOAuthState: "googleOAuthState",
  GoogleOAuthNonce: "googleOAuthNonce",
  DarkMode: "darkMode",
  HasSeenWelcomeMessage: "hasSeenWelcomeMessage",
};

export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** ID of the AnonGroup the corresponding user belongs to */
  anonGroupId: string;
  /** Name of the provider that generated the proof that the user (user's ephemeral pubkey) belongs to the AnonGroup */
  anonGroupProvider: string;
  /** Content of the message */
  text: string;
  /** Unix timestamp when the message was created */
  timestamp: Date;
  /** Whether this message is only visible to other members of the same AnonGroup */
  internal: boolean;
  /** Number of likes message received */
  likes: number;
}

export interface SignedMessage extends Message {
  /** Ed25519 signature of the message - signed by the user's ephemeral private key (in hex format) */
  signature: bigint;
  /** Ed25519 pubkey that can verify the signature */
  ephemeralPubkey: bigint;
  /** Expiry of the ephemeral pubkey */
  ephemeralPubkeyExpiry: Date;
}
