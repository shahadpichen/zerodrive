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
} from "../types";
import { sendFileShareNotification } from "../services/emailService";
import {
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory,
  getFileSizeBucket,
  getFileTypeCategory,
} from "../services/analytics";
import { deriveRecipientLookupId } from "../utils/identity";
import crypto from "crypto";

const router = Router();

function toClientSharedFile(file: SharedFile) {
  const {
    file_id: _privateObjectKey,
    recipient_user_id: _privateRecipientId,
    management_capability_hash: _privateCapabilityHash,
    ...safeFile
  } = file;
  return safeFile;
}

function capabilityMatches(
  plaintextCapability: string | undefined,
  expectedHash: string,
): boolean {
  if (!plaintextCapability) return false;
  const actualHash = crypto
    .createHash("sha256")
    .update(plaintextCapability, "utf8")
    .digest();
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actualHash.length === expected.length &&
    crypto.timingSafeEqual(actualHash, expected)
  );
}

// Validation schemas
const createSharedFileSchema = Joi.object({
  file_id: Joi.string().required(),
  management_capability_hash: Joi.string().hex().length(64).required(),
  recipient_email: Joi.string().email().required(),
  custom_message: Joi.string().max(500).optional(), // Optional custom message from sender
  encrypted_file_key: Joi.string().required(),
  file_name: Joi.string().required(),
  file_size: Joi.number().integer().min(0).required(),
  mime_type: Joi.string().required(),
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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = createSharedFileSchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const {
      file_id,
      management_capability_hash,
      recipient_email,
      custom_message,
      encrypted_file_key,
      file_name,
      file_size,
      mime_type,
      expires_at,
      access_type,
    } = value;
    const recipientUserId = deriveRecipientLookupId(recipient_email);

    try {
      // Check if file is already shared with this recipient
      const existingShare = await query<SharedFile>(
        "SELECT id FROM shared_files WHERE file_id = $1 AND recipient_user_id = $2",
        [file_id, recipientUserId],
      );

      if (existingShare.rows.length > 0) {
        throw ApiErrors.Conflict("File is already shared with this user");
      }

      // Create new shared file record
      const result = await query<SharedFile>(
        `INSERT INTO shared_files (
        file_id, recipient_user_id, encrypted_file_key,
        file_name, file_size, mime_type, expires_at, access_type,
        management_capability_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
        [
          file_id,
          recipientUserId,
          encrypted_file_key,
          file_name,
          file_size,
          mime_type,
          expires_at || null,
          access_type,
          management_capability_hash,
        ],
      );

      // Send email notification (non-blocking)
      // Only send email if user provided a custom message
      // Don't wait for email to complete - respond immediately to user
      if (recipient_email && custom_message) {
        sendFileShareNotification(recipient_email, custom_message).catch(
          (error) => {
            console.error(
              "[SharedFiles] Failed to send email notification:",
              error.message,
            );
            // Don't throw - email failure should not fail the file sharing operation
          },
        );
      }

      // Track file share event (anonymous)
      trackEvent(AnalyticsEvent.FILE_SHARED, AnalyticsCategory.SHARING, {
        file_size_bucket: getFileSizeBucket(file_size),
        file_type: getFileTypeCategory(mime_type),
        has_expiration: !!expires_at,
        has_custom_message: !!custom_message,
      }).catch(() => {}); // Don't let analytics fail the request

      res.apiSuccess(
        toClientSharedFile(result.rows[0]),
        "File shared successfully",
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
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [recipientUserIds],
      );
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results for recipient
      const result = await query<SharedFile>(
        `SELECT * FROM shared_files
       WHERE recipient_user_id = ANY($1::varchar[])
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

      const result = await query<SharedFile>(
        `SELECT * FROM shared_files 
       WHERE id = $1
       AND recipient_user_id = $2
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id, req.user.emailHash],
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
          !capabilityMatches(
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
      let result;
      if (suppliedCapability) {
        const existing = await query<SharedFile>(
          "SELECT * FROM shared_files WHERE id = $1",
          [id],
        );
        if (existing.rows.length === 0) {
          throw ApiErrors.NotFound("Shared file not found");
        }
        const share = existing.rows[0];
        if (
          !share.management_capability_hash ||
          !capabilityMatches(
            suppliedCapability,
            share.management_capability_hash,
          )
        ) {
          throw ApiErrors.Forbidden("Invalid share management capability");
        }
        result = await query("DELETE FROM shared_files WHERE id = $1", [id]);
      } else {
        const recipientIds = [
          req.user.emailHash,
          ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
        ];
        result = await query(
          `DELETE FROM shared_files
           WHERE id = $1
           AND management_capability_hash IS NULL
           AND recipient_user_id = ANY($2::varchar[])`,
          [id, recipientIds],
        );
      }

      if (result.rowCount === 0) {
        throw ApiErrors.NotFound("Shared file not found");
      }

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
      const sharedFile = await query<SharedFile>(
        `SELECT * FROM shared_files 
       WHERE id = $1
       AND recipient_user_id = $2
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id, req.user.emailHash],
      );

      if (sharedFile.rows.length === 0) {
        throw ApiErrors.NotFound("Shared file not found or has expired");
      }

      // Update last accessed timestamp
      await query(
        "UPDATE shared_files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id],
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
