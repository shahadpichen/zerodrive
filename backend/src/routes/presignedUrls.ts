/**
 * Pre-signed URL Routes
 * Generates temporary upload/download URLs for MinIO without exposing credentials
 */

import { Router, Request, Response } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Joi from "joi";
import { s3Client, MINIO_BUCKET } from "../config/s3";
import { query } from "../config/database";
import logger from "../utils/logger";
import { shareCapabilityMatches } from "../utils/shareCapability";
import { accountLimit } from "../middleware/accountLimits";

const router = Router();

// Validation schemas
const uploadUrlSchema = Joi.object({
  shareId: Joi.string().uuid().required(),
});

const downloadUrlSchema = Joi.object({
  shareId: Joi.string().uuid().required(),
});

/**
 * POST /api/presigned-url/upload
 * Generate a pre-signed URL for uploading an encrypted file
 */
router.post(
  "/upload",
  accountLimit({
    name: "pending-upload",
    max: process.env.NODE_ENV === "test" ? 1000 : 20,
    windowMs: 15 * 60 * 1000,
  }),
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const { error, value } = uploadUrlSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.details[0].message,
          },
        });
      }

      const capability = req.get("x-share-capability");
      const pending = await query<{
        file_id: string;
        expected_encrypted_size: string | number;
        management_capability_hash: string;
      }>(
        `SELECT file_id, expected_encrypted_size, management_capability_hash
       FROM shared_files
       WHERE id = $1
       AND status = 'pending'
       AND pending_expires_at > CURRENT_TIMESTAMP`,
        [value.shareId],
      );
      if (
        pending.rows.length === 0 ||
        !shareCapabilityMatches(
          capability,
          pending.rows[0].management_capability_hash,
        )
      ) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Pending share not found" },
        });
      }

      const fileKey = pending.rows[0].file_id;
      const expectedSize = Number(pending.rows[0].expected_encrypted_size);

      // Create pre-signed URL for upload (expires in 5 minutes)
      const command = new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: fileKey,
        ContentType: "application/octet-stream",
        ContentLength: expectedSize,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 300, // 5 minutes
      });

      logger.info("Authorized upload URL generated", {
        requestId: req.requestId,
      });

      return res.json({
        success: true,
        data: {
          uploadUrl,
          expiresIn: 300,
        },
        message: "Pre-signed upload URL generated",
      });
    } catch (error) {
      logger.error("Failed to generate upload URL", error as Error);
      return res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to generate upload URL",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },
);

/**
 * POST /api/presigned-url/download
 * Generate a pre-signed URL for downloading an encrypted file
 */
router.post("/download", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = downloadUrlSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.details[0].message,
        },
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const recipientUserIds = [
      req.user.emailHash,
      ...(req.user.legacyEmailHash ? [req.user.legacyEmailHash] : []),
    ];
    const shareResult = await query<{ file_id: string }>(
      `SELECT file_id
       FROM shared_files
       WHERE id = $1
       AND recipient_user_id = ANY($2::varchar[])
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [value.shareId, recipientUserIds],
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Shared file not found or has expired",
        },
      });
    }

    const fileKey = shareResult.rows[0].file_id;
    logger.info("Generating authorized download URL", {
      requestId: req.requestId,
    });

    // Create pre-signed URL for download (expires in 5 minutes)
    const command = new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    logger.info("Authorized download URL generated", {
      requestId: req.requestId,
    });

    return res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn: 300,
      },
      message: "Pre-signed download URL generated",
    });
  } catch (error) {
    logger.error("Failed to generate download URL", error as Error);
    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to generate download URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
});

export default router;
