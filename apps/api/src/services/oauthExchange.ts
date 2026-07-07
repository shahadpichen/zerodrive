import crypto from "crypto";
import { query } from "../config/database";

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CONTEXT = "zerodrive/oauth-exchange/v1";

export interface OAuthExchangePayload {
  ownerHash: string;
  expiresAt: number;
  tokens: {
    accessToken: string;
    expiresAt: string;
    scope: string;
  };
  isNewUser: boolean;
  hasLimitedScope: boolean;
}

function encryptionKey(): Buffer {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is not configured");
  return crypto.createHash("sha256").update(`${CONTEXT}:${jwtSecret}`).digest();
}

function capabilityHash(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function encrypt(payload: OAuthExchangePayload): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(CONTEXT));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url");
}

function decrypt(code: string): OAuthExchangePayload {
  const envelope = Buffer.from(code, "base64url");
  if (envelope.length <= 1 + IV_BYTES + TAG_BYTES || envelope[0] !== VERSION) {
    throw new Error("Invalid OAuth exchange capability");
  }
  const iv = envelope.subarray(1, 1 + IV_BYTES);
  const tag = envelope.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = envelope.subarray(1 + IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(CONTEXT));
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    ),
  ) as OAuthExchangePayload;
}

export async function createOAuthExchange(
  payload: OAuthExchangePayload,
): Promise<string> {
  const code = encrypt(payload);
  await query(
    "DELETE FROM oauth_exchanges WHERE expires_at <= CURRENT_TIMESTAMP",
  );
  await query(
    `INSERT INTO oauth_exchanges (code_hash, expires_at)
     VALUES ($1, to_timestamp($2 / 1000.0))`,
    [capabilityHash(code), payload.expiresAt],
  );
  return code;
}

export async function consumeOAuthExchange(
  code: string,
): Promise<OAuthExchangePayload | null> {
  if (typeof code !== "string" || code.length > 8192) return null;
  const consumed = await query(
    `DELETE FROM oauth_exchanges
     WHERE code_hash = $1
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING code_hash`,
    [capabilityHash(code)],
  );
  if (consumed.rowCount !== 1) return null;

  try {
    const payload = decrypt(code);
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
