/**
 * Shared Files Routes (TypeScript)
 */

import { Router } from "express";
import Joi from "joi";
import { query, transaction } from "../config/database";
import { asyncHandler, ApiError, ApiErrors } from "../middleware/errorHandler";
import { Request, Response } from "express";
import {
  SharedFile,
  CreateSharedFileRequest,
  UpdateSharedFileRequest,
  GetSharedFileRequest,
  GetSharedFilesQuery,
  PublicKey,
} from "../types";
import { sendFileShareNotification } from "../services/emailService";
import {
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory,
  getFileSizeBucket,
} from "../services/analytics";
import {
  deriveLookupCandidates,
  deriveRecipientLookupId,
} from "../utils/identity";
import { shareCapabilityMatches } from "../utils/shareCapability";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { MINIO_BUCKET, s3Client } from "../config/s3";
import crypto from "crypto";
import { accountLimit } from "../middleware/accountLimits";

const router = Router();
const MAX_ENCRYPTED_FILE_SIZE = 100 * 1024 * 1024 + 64 * 1024;

function validateWrappedFileKey(value: string, helpers: Joi.CustomHelpers) {
  try {
    const envelope = JSON.parse(value);
    const fields =
      envelope && typeof envelope === "object" ? Object.keys(envelope) : [];
    if (
      fields.length !== 6 ||
      !fields.every((field) =>
        [
          "v",
          "keyWrap",
          "contentEncryption",
          "recipientKeyVersion",
          "recipientKeyFingerprint",
          "ciphertext",
        ].includes(field),
      ) ||
      envelope?.v !== 2 ||
      envelope?.keyWrap !== "RSA-OAEP-256" ||
      envelope?.contentEncryption !== "AES-256-GCM" ||
      !Number.isInteger(envelope?.recipientKeyVersion) ||
      envelope.recipientKeyVersion < 1 ||
      !/^[0-9a-f]{64}$/.test(envelope?.recipientKeyFingerprint) ||
      typeof envelope?.ciphertext !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext) ||
      Buffer.from(envelope.ciphertext, "base64").byteLength !== 256
    ) {
      return helpers.error("any.invalid");
    }
    return value;
  } catch {
    return helpers.error("any.invalid");
  }
}

function toClientSharedFile(file: SharedFile) {
  const {
    deployment_id: _privateDeploymentId,
    file_id: _privateObjectKey,
    recipient_user_id: _privateRecipientId,
    management_capability_hash: _privateCapabilityHash,
    ...safeFile
  } = file;
  return safeFile;
}

// Validation schemas
const createSharedFileSchema = Joi.object({
  management_capability_hash: Joi.string().hex().length(64).required(),
  recipient_email: Joi.string().email().required(),
  content_format: Joi.string()
    .valid("legacy_zdse", "capsule_v1")
    .default("legacy_zdse"),
  recipient_key_version: Joi.when("content_format", {
    is: "capsule_v1",
    then: Joi.number().integer().min(1).max(2147483647).required(),
    otherwise: Joi.number().integer().min(1).max(2147483647).optional(),
  }),
  recipient_key_fingerprint: Joi.when("content_format", {
    is: "capsule_v1",
    then: Joi.string().hex().lowercase().length(64).required(),
    otherwise: Joi.string().hex().lowercase().length(64).optional(),
  }),
  encrypted_file_key: Joi.when("content_format", {
    is: "capsule_v1",
    then: Joi.valid(null).optional(),
    otherwise: Joi.string()
      .max(2048)
      .custom(validateWrappedFileKey, "versioned wrapped file key")
      .required(),
  }),
  encrypted_metadata: Joi.string().base64().required().max(32768),
  file_size: Joi.number().integer().min(0).required(),
  encrypted_size: Joi.number()
    .integer()
    .positive()
    .max(MAX_ENCRYPTED_FILE_SIZE)
    .required(),
  expires_at: Joi.date().iso().optional(),
  access_type: Joi.string().valid("view", "download").default("view"),
});

const updateSharedFileSchema = Joi.object({
  access_type: Joi.string().valid("view", "download").optional(),
  expires_at: Joi.date().iso().allow(null).optional(),
});

const getSharedFileSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const getSharedFilesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

/**
 * POST /api/shared-files
 * Share a file with another user
 */
router.post(
  "/",
  accountLimit({
    name: "share-create",
    max: process.env.NODE_ENV === "test" ? 1000 : 20,
    windowMs: 60 * 60 * 1000,
  }),
  accountLimit({
    // A conservative, ephemeral pending reservation. It expires with the
    // pending-share TTL and is never written to PostgreSQL or linked to rows.
    name: "pending-share-quota",
    max: process.env.NODE_ENV === "test" ? 1000 : 5,
    windowMs: 15 * 60 * 1000,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = createSharedFileSchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const {
      management_capability_hash,
      recipient_email,
      content_format,
      recipient_key_version,
      recipient_key_fingerprint,
      encrypted_file_key,
      encrypted_metadata,
      file_size,
      encrypted_size,
      expires_at,
      access_type,
    } = value;
    const recipientUserId = deriveRecipientLookupId(recipient_email);
    const objectKey = `shared/${crypto.randomUUID()}`;

    try {
      if (content_format === "capsule_v1") {
        const recipientLookupIds = deriveLookupCandidates(recipient_email);
        const activeKey = await query<PublicKey>(
          `SELECT key_version, fingerprint
           FROM public_keys
           WHERE user_id = ANY($1::varchar[]) AND is_active = TRUE
           ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END
           LIMIT 1`,
          [recipientLookupIds, recipientLookupIds[0]],
        );
        const activeRecipientKey = activeKey.rows[0];
        if (
          !activeRecipientKey ||
          activeRecipientKey.key_version !== recipient_key_version ||
          activeRecipientKey.fingerprint !== recipient_key_fingerprint
        ) {
          throw ApiErrors.Conflict(
            "Recipient sharing identity changed; refresh it before sharing",
          );
        }
      }

      const existingShare = await query<SharedFile>(
        "SELECT id FROM shared_files WHERE management_capability_hash = $1",
        [management_capability_hash],
      );
      if (existingShare.rows.length > 0) {
        throw ApiErrors.Conflict("Share capability collision");
      }

      // Create a pending record before issuing upload authority. This keeps
      // abandoned objects discoverable and cleanup-safe.
      const result = await query<SharedFile>(
        `INSERT INTO shared_files (
        file_id, recipient_user_id, encrypted_file_key,
        encrypted_metadata, file_size, expires_at, access_type,
        management_capability_hash, status, expected_encrypted_size,
        pending_expires_at, content_format, recipient_key_version,
        recipient_key_fingerprint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9,
        CURRENT_TIMESTAMP + INTERVAL '15 minutes', $10, $11, $12)
      RETURNING *`,
        [
          objectKey,
          recipientUserId,
          encrypted_file_key,
          encrypted_metadata,
          file_size,
          expires_at || null,
          access_type,
          management_capability_hash,
          encrypted_size,
          content_format,
          recipient_key_version || null,
          recipient_key_fingerprint || null,
        ],
      );

      // Send a generic notification. File metadata and the sender's message
      // remain encrypted and are never disclosed to the backend/email provider.
      sendFileShareNotification(recipient_email).catch(() => {});

      // Track file share event (anonymous)
      trackEvent(AnalyticsEvent.FILE_SHARED, AnalyticsCategory.SHARING, {
        file_size_bucket: getFileSizeBucket(file_size),
        has_expiration: !!expires_at,
      }).catch(() => {}); // Don't let analytics fail the request

      res.apiSuccess(
        toClientSharedFile(result.rows[0]),
        "Pending share created",
        201,
      );
    } catch (error) {
      // Re-throw known error types with specific messages (Conflict, etc.)
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to share file");
    }
  }),
);

router.post(
  "/:id/finalize",
  asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = getSharedFileSchema.validate(req.params);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const pending = await query<SharedFile>(
      `SELECT * FROM shared_files
       WHERE id = $1
       AND status = 'pending'
       AND pending_expires_at > CURRENT_TIMESTAMP`,
      [value.id],
    );
    if (pending.rows.length === 0) {
      throw ApiErrors.NotFound("Pending share not found or has expired");
    }

    const share = pending.rows[0];
    const capability = req.get("x-share-capability");
    if (
      !share.management_capability_hash ||
      !shareCapabilityMatches(capability, share.management_capability_hash)
    ) {
      throw ApiErrors.NotFound("Pending share not found or has expired");
    }

    let objectSize: number;
    try {
      const object = await s3Client.send(
        new HeadObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: share.file_id,
        }),
      );
      objectSize = Number(object.ContentLength);
    } catch {
      throw ApiErrors.Conflict("Encrypted upload is not available yet");
    }

    if (
      !Number.isSafeInteger(objectSize) ||
      objectSize !== Number(share.expected_encrypted_size)
    ) {
      throw ApiErrors.Conflict("Encrypted upload size does not match");
    }

    const activated = await query<SharedFile>(
      `UPDATE shared_files
       SET status = 'active',
           pending_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [value.id],
    );
    if (activated.rows.length === 0) {
      throw ApiErrors.Conflict("Share could not be finalized");
    }

    void trackEvent(AnalyticsEvent.SHARE_FINALIZED, AnalyticsCategory.SHARING);

    res.apiSuccess(toClientSharedFile(activated.rows[0]), "Share finalized");
  }),
);

/**
 * GET /api/shared-files
 * Get shared files for a recipient
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate query parameters
    const { error, value } = getSharedFilesQuerySchema.validate(req.query);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    if (!req.user) {
      throw ApiErrors.Unauthorized("Not authenticated");
    }

    const { limit, offset } = value;
    const recipientUserIds = [
      req.user.emailHash,
      ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
    ];

    try {
      // Get total count for recipient
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM shared_files
         WHERE recipient_user_id = ANY($1::varchar[])
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [recipientUserIds],
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results for recipient
      const result = await query<SharedFile>(
        `SELECT * FROM shared_files
       WHERE recipient_user_id = ANY($1::varchar[])
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
        [recipientUserIds, limit, offset],
      );

      const hasMore = offset + limit < total;

      res.apiSuccess(
        {
          files: result.rows.map(toClientSharedFile),
          total,
          hasMore,
        },
        "Shared files retrieved successfully",
      );
    } catch (error) {
      throw ApiErrors.InternalServer("Failed to retrieve shared files");
    }
  }),
);

/**
 * GET /api/shared-files/:id
 * Get a specific shared file
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request parameters
    const { error, value } = getSharedFileSchema.validate(req.params);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const { id } = value;

    try {
      if (!req.user) {
        throw ApiErrors.Unauthorized("Not authenticated");
      }

      const recipientIds = [
        req.user.emailHash,
        ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
      ];
      const result = await query<SharedFile>(
        `SELECT * FROM shared_files 
       WHERE id = $1
       AND recipient_user_id = ANY($2::varchar[])
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id, recipientIds],
      );

      if (result.rows.length === 0) {
        throw ApiErrors.NotFound("Shared file not found or has expired");
      }

      res.apiSuccess(
        toClientSharedFile(result.rows[0]),
        "Shared file retrieved successfully",
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to retrieve shared file");
    }
  }),
);

/**
 * PUT /api/shared-files/:id
 * Update shared file permissions
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request parameters
    const { error: paramError, value: paramValue } =
      getSharedFileSchema.validate(req.params);
    if (paramError) {
      throw ApiErrors.ValidationError(paramError.details[0].message);
    }

    // Validate request body
    const { error: bodyError, value: bodyValue } =
      updateSharedFileSchema.validate(req.body);
    if (bodyError) {
      throw ApiErrors.ValidationError(bodyError.details[0].message);
    }

    const { id } = paramValue;
    const { access_type, expires_at } = bodyValue;

    try {
      if (!req.user) {
        throw ApiErrors.Unauthorized("Not authenticated");
      }

      const suppliedCapability = req.get("x-share-capability");
      const recipientIds = [
        req.user.emailHash,
        ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
      ];
      const existingFile = await query<SharedFile>(
        suppliedCapability
          ? "SELECT * FROM shared_files WHERE id = $1"
          : `SELECT * FROM shared_files
             WHERE id = $1
             AND management_capability_hash IS NULL
             AND recipient_user_id = ANY($2::varchar[])`,
        suppliedCapability ? [id] : [id, recipientIds],
      );

      if (existingFile.rows.length === 0) {
        throw ApiErrors.NotFound("Shared file not found");
      }
      const existing = existingFile.rows[0];
      if (existing.management_capability_hash) {
        if (
          !shareCapabilityMatches(
            suppliedCapability,
            existing.management_capability_hash,
          )
        ) {
          throw ApiErrors.Forbidden("Invalid share management capability");
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (access_type !== undefined) {
        updates.push(`access_type = $${paramIndex++}`);
        params.push(access_type);
      }

      if (expires_at !== undefined) {
        updates.push(`expires_at = $${paramIndex++}`);
        params.push(expires_at);
      }

      if (updates.length === 0) {
        throw ApiErrors.BadRequest("No valid fields to update");
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const result = await query<SharedFile>(
        `UPDATE shared_files 
       SET ${updates.join(", ")} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
        params,
      );

      res.apiSuccess(
        toClientSharedFile(result.rows[0]),
        "Shared file updated successfully",
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("No valid fields"))
      ) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to update shared file");
    }
  }),
);

/**
 * DELETE /api/shared-files/:id
 * Revoke file sharing
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request parameters
    const { error, value } = getSharedFileSchema.validate(req.params);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const { id } = value;

    try {
      if (!req.user) {
        throw ApiErrors.Unauthorized("Not authenticated");
      }

      const suppliedCapability = req.get("x-share-capability");
      let share: SharedFile | undefined;
      if (suppliedCapability) {
        const existing = await query<SharedFile>(
          "SELECT * FROM shared_files WHERE id = $1",
          [id],
        );
        if (existing.rows.length === 0) {
          throw ApiErrors.NotFound("Shared file not found");
        }
        share = existing.rows[0];
        if (
          !share.management_capability_hash ||
          !shareCapabilityMatches(
            suppliedCapability,
            share.management_capability_hash,
          )
        ) {
          throw ApiErrors.Forbidden("Invalid share management capability");
        }
      } else {
        const recipientIds = [
          req.user.emailHash,
          ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
        ];
        const existing = await query<SharedFile>(
          `SELECT * FROM shared_files
           WHERE id = $1
           AND management_capability_hash IS NULL
           AND recipient_user_id = ANY($2::varchar[])`,
          [id, recipientIds],
        );
        share = existing.rows[0];
      }

      if (!share) {
        throw ApiErrors.NotFound("Shared file not found");
      }

      await query(
        `UPDATE shared_files
         SET status = 'deleting', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id],
      );

      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: share.file_id,
          }),
        );
      } catch {
        await query(
          `UPDATE shared_files
           SET deletion_attempts = deletion_attempts + 1,
               deletion_last_error = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id, "OBJECT_DELETE_FAILED"],
        );
        throw ApiErrors.ServiceUnavailable(
          "Share deletion is queued for retry",
        );
      }

      await query("DELETE FROM shared_files WHERE id = $1", [id]);
      void trackEvent(AnalyticsEvent.SHARE_REVOKED, AnalyticsCategory.SHARING);
      res.apiSuccess({ deleted: true }, "File sharing revoked successfully");
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to revoke file sharing");
    }
  }),
);

/**
 * POST /api/shared-files/:id/access
 * Record file access (for analytics/tracking)
 */
router.post(
  "/:id/access",
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request parameters
    const { error, value } = getSharedFileSchema.validate(req.params);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const { id } = value;

    try {
      if (!req.user) {
        throw ApiErrors.Unauthorized("Not authenticated");
      }

      // Check if shared file exists and is not expired
      const recipientIds = [
        req.user.emailHash,
        ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
      ];
      const sharedFile = await query<SharedFile>(
        `SELECT * FROM shared_files 
       WHERE id = $1
       AND recipient_user_id = ANY($2::varchar[])
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id, recipientIds],
      );

      if (sharedFile.rows.length === 0) {
        throw ApiErrors.NotFound("Shared file not found or has expired");
      }

      // Update last accessed timestamp
      await query(
        "UPDATE shared_files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id],
      );

      void trackEvent(
        AnalyticsEvent.SHARED_FILE_ACCESSED,
        AnalyticsCategory.SHARING,
      );

      res.apiSuccess({ recorded: true }, "File access recorded successfully");
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw ApiErrors.InternalServer("Failed to record file access");
    }
  }),
);

export default router;
