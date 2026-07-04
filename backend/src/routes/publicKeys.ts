/**
 * Public Keys Routes (TypeScript)
 */

import { Router } from "express";
import Joi from "joi";
import { query, transaction } from "../config/database";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiErrors } from "../middleware/errorHandler";
import { Request, Response } from "express";
import { PublicKey } from "../types";
import { deriveLookupCandidates } from "../utils/identity";
import crypto from "crypto";
import { accountLimit } from "../middleware/accountLimits";

const router = Router();

// Validation schemas
const createPublicKeySchema = Joi.object({
  public_key: Joi.string().required().max(16384),
});

const lookupPublicKeySchema = Joi.object({
  email: Joi.string().email().required(),
});

interface PublicEncryptionJwk {
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
  key_ops?: string[];
  d?: string;
}

function validatePublicKeyJwk(serializedKey: string): PublicEncryptionJwk {
  let key: PublicEncryptionJwk;

  try {
    key = JSON.parse(serializedKey) as PublicEncryptionJwk;
  } catch {
    throw ApiErrors.ValidationError("public_key must be valid JSON");
  }

  let modulusBytes = 0;
  try {
    modulusBytes = key.n ? Buffer.from(key.n, "base64url").byteLength : 0;
  } catch {
    modulusBytes = 0;
  }

  const isEncryptionKey =
    key.kty === "RSA" &&
    typeof key.n === "string" &&
    modulusBytes === 256 &&
    key.e === "AQAB" &&
    (!key.alg || key.alg === "RSA-OAEP-256") &&
    (!key.key_ops ||
      (key.key_ops.length === 1 && key.key_ops[0] === "encrypt")) &&
    key.d === undefined;

  if (!isEncryptionKey) {
    throw ApiErrors.ValidationError(
      "public_key must be an RSA-OAEP-256 public encryption JWK",
    );
  }
  return key;
}

function fingerprintPublicKey(key: PublicEncryptionJwk): string {
  const canonicalKey = JSON.stringify({ e: key.e, kty: key.kty, n: key.n });
  return crypto.createHash("sha256").update(canonicalKey).digest("hex");
}

function toClientPublicKey(record: PublicKey) {
  const { user_id: _privateLookupId, ...safeRecord } = record;
  return safeRecord;
}

/**
 * POST /api/public-keys
 * Store a user's public key
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = createPublicKeySchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    if (!req.user) {
      throw ApiErrors.Unauthorized("Not authenticated");
    }

    const { public_key } = value;
    const userId = req.user.emailHash;
    const fingerprint = fingerprintPublicKey(validatePublicKeyJwk(public_key));

    try {
      const stored = await transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          userId,
        ]);
        const existingKey = await client.query<PublicKey>(
          `SELECT * FROM public_keys
           WHERE user_id = $1 AND is_active = TRUE
           FOR UPDATE`,
          [userId],
        );
        const active = existingKey.rows[0];
        if (active?.fingerprint === fingerprint) {
          return { record: active, created: false };
        }

        const versionResult = await client.query<{ next_version: number }>(
          `SELECT COALESCE(MAX(key_version), 0) + 1 AS next_version
           FROM public_keys WHERE user_id = $1`,
          [userId],
        );
        const keyVersion = versionResult.rows[0].next_version;

        await client.query(
          `UPDATE public_keys SET is_active = FALSE
           WHERE user_id = $1 AND is_active = TRUE`,
          [userId],
        );
        const inserted = await client.query<PublicKey>(
          `INSERT INTO public_keys
             (user_id, public_key, key_version, fingerprint, is_active)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING *`,
          [userId, public_key, keyVersion, fingerprint],
        );
        return { record: inserted.rows[0], created: true };
      });

      res.apiSuccess(
        toClientPublicKey(stored.record),
        stored.created
          ? "Public key version stored successfully"
          : "Public key already current",
        stored.created ? 201 : 200,
      );
    } catch (error) {
      throw ApiErrors.InternalServer("Failed to store public key");
    }
  }),
);

/**
 * POST /api/public-keys/lookup
 * Resolve a recipient public key without exposing internal identifiers.
 */
router.post(
  "/lookup",
  accountLimit({
    name: "directory-lookup",
    max: process.env.NODE_ENV === "test" ? 1000 : 30,
    windowMs: 15 * 60 * 1000,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = lookupPublicKeySchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    try {
      const lookupIds = deriveLookupCandidates(value.email);
      const result = await query<PublicKey>(
        `SELECT public_key, key_version, fingerprint
         FROM public_keys
         WHERE user_id = ANY($1::varchar[]) AND is_active = TRUE
         ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END
         LIMIT 1`,
        [lookupIds, lookupIds[0]],
      );

      if (result.rows.length === 0) {
        throw ApiErrors.NotFound("Public key not found for this user");
      }

      res.apiSuccess(
        {
          public_key: result.rows[0].public_key,
          key_version: result.rows[0].key_version,
          fingerprint:
            result.rows[0].fingerprint ||
            fingerprintPublicKey(
              validatePublicKeyJwk(result.rows[0].public_key),
            ),
        },
        "Public key retrieved successfully",
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to retrieve public key");
    }
  }),
);

/**
 * DELETE /api/public-keys
 * Delete a user's public key
 */
router.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiErrors.Unauthorized("Not authenticated");
    }

    try {
      const result = await query("DELETE FROM public_keys WHERE user_id = $1", [
        req.user.emailHash,
      ]);

      if (result.rowCount === 0) {
        throw ApiErrors.NotFound("Public key not found for this user");
      }

      res.apiSuccess({ deleted: true }, "Public key deleted successfully");
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to delete public key");
    }
  }),
);

export default router;
