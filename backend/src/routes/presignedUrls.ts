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

const router = Router();

// Validation schemas
const uploadUrlSchema = Joi.object({
  fileName: Joi.string().required().max(255),
  fileSize: Joi.number().integer().positive().optional(),
  mimeType: Joi.string().optional(),
  recipientEmail: Joi.string().email().optional(),
});

const downloadUrlSchema = Joi.object({
  shareId: Joi.string().uuid().required(),
});

/**
 * POST /api/presigned-url/upload
 * Generate a pre-signed URL for uploading an encrypted file
 */
router.post("/upload", async (req: Request, res: Response) => {
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

    const { fileName, fileSize, mimeType } = value;

    // Generate unique file key (prevent overwriting)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileKey = `shared/${timestamp}-${randomId}-${fileName}`;

    logger.info("Generating upload URL", {
      fileName,
      fileKey,
      fileSize,
      mimeType,
    });

    // Create pre-signed URL for upload (expires in 5 minutes)
    const command = new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: fileKey,
      ContentType: mimeType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    logger.info("Upload URL generated", { fileKey });

    return res.json({
      success: true,
      data: {
        uploadUrl,
        fileKey,
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
});

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

    const shareResult = await query<{ file_id: string }>(
      `SELECT file_id
       FROM shared_files
       WHERE id = $1
       AND recipient_user_id = $2
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [value.shareId, req.user.emailHash],
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
      shareId: value.shareId,
    });

    // Create pre-signed URL for download (expires in 5 minutes)
    const command = new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    logger.info("Download URL generated", { fileKey });

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
