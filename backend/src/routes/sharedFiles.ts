/**
 * Shared Files Routes (TypeScript)
 */

import { Router } from 'express';
import Joi from 'joi';
import { query, transaction } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiErrors } from '../middleware/errorHandler';
import { Request, Response } from 'express';
import {
  SharedFile,
  CreateSharedFileRequest,
  UpdateSharedFileRequest,
  GetSharedFileRequest,
  GetSharedFilesQuery
} from '../types';
import { sendFileShareNotification } from '../services/emailService';

const router = Router();

// Validation schemas
const createSharedFileSchema = Joi.object({
  file_id: Joi.string().required(),
  owner_user_id: Joi.string().required(),
  recipient_user_id: Joi.string().required(),
  recipient_email: Joi.string().email().optional(), // For email notifications
  encrypted_file_key: Joi.string().required(),
  file_name: Joi.string().required(),
  file_size: Joi.number().integer().min(0).required(),
  mime_type: Joi.string().required(),
  expires_at: Joi.date().iso().optional(),
  access_type: Joi.string().valid('view', 'download').default('view')
});

const updateSharedFileSchema = Joi.object({
  access_type: Joi.string().valid('view', 'download').optional(),
  expires_at: Joi.date().iso().allow(null).optional()
});

const getSharedFileSchema = Joi.object({
  id: Joi.string().uuid().required()
});

const getSharedFilesQuerySchema = Joi.object({
  owner_user_id: Joi.string().optional(),
  recipient_user_id: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * POST /api/shared-files
 * Share a file with another user
 */
router.post('/', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request body
  const { error, value } = createSharedFileSchema.validate(req.body);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const {
    file_id,
    owner_user_id,
    recipient_user_id,
    recipient_email,
    encrypted_file_key,
    file_name,
    file_size,
    mime_type,
    expires_at,
    access_type
  } = value;

  // Validate that owner and recipient are different
  if (owner_user_id === recipient_user_id) {
    throw ApiErrors.BadRequest('Cannot share file with yourself');
  }

  try {
    // Check if file is already shared with this recipient
    const existingShare = await query<SharedFile>(
      'SELECT id FROM shared_files WHERE file_id = $1 AND owner_user_id = $2 AND recipient_user_id = $3',
      [file_id, owner_user_id, recipient_user_id]
    );

    if (existingShare.rows.length > 0) {
      throw ApiErrors.Conflict('File is already shared with this user');
    }

    // Create new shared file record
    const result = await query<SharedFile>(
      `INSERT INTO shared_files (
        file_id, owner_user_id, recipient_user_id, encrypted_file_key,
        file_name, file_size, mime_type, expires_at, access_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        file_id,
        owner_user_id,
        recipient_user_id,
        encrypted_file_key,
        file_name,
        file_size,
        mime_type,
        expires_at || null,
        access_type
      ]
    );

    // Send email notification (non-blocking)
    // Don't wait for email to complete - respond immediately to user
    if (recipient_email) {
      sendFileShareNotification(recipient_email).catch(error => {
        console.error('[SharedFiles] Failed to send email notification:', error.message);
        // Don't throw - email failure should not fail the file sharing operation
      });
    }

    res.apiSuccess(result.rows[0], 'File shared successfully', 201);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already shared') || error.message.includes('yourself'))) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to share file');
  }
}));

/**
 * GET /api/shared-files
 * Get shared files (as owner or recipient)
 */
router.get('/', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate query parameters
  const { error, value } = getSharedFilesQuerySchema.validate(req.query);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { owner_user_id, recipient_user_id, limit, offset } = value;

  // At least one user ID must be provided
  if (!owner_user_id && !recipient_user_id) {
    throw ApiErrors.BadRequest('Either owner_user_id or recipient_user_id must be provided');
  }

  try {
    let whereClause = '';
    let params: any[] = [];
    
    if (owner_user_id && recipient_user_id) {
      whereClause = 'WHERE (owner_user_id = $1 OR recipient_user_id = $2)';
      params = [owner_user_id, recipient_user_id];
    } else if (owner_user_id) {
      whereClause = 'WHERE owner_user_id = $1';
      params = [owner_user_id];
    } else if (recipient_user_id) {
      whereClause = 'WHERE recipient_user_id = $1';
      params = [recipient_user_id];
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM shared_files ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query<SharedFile>(
      `SELECT * FROM shared_files 
       ${whereClause}
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const hasMore = offset + limit < total;

    res.apiSuccess({
      files: result.rows,
      total,
      hasMore
    }, 'Shared files retrieved successfully');
  } catch (error) {
    throw ApiErrors.InternalServer('Failed to retrieve shared files');
  }
}));

/**
 * GET /api/shared-files/:id
 * Get a specific shared file
 */
router.get('/:id', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getSharedFileSchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { id } = value;

  try {
    const result = await query<SharedFile>(
      `SELECT * FROM shared_files 
       WHERE id = $1 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [id]
    );

    if (result.rows.length === 0) {
      throw ApiErrors.NotFound('Shared file not found or has expired');
    }

    res.apiSuccess(result.rows[0], 'Shared file retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to retrieve shared file');
  }
}));

/**
 * PUT /api/shared-files/:id
 * Update shared file permissions
 */
router.put('/:id', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error: paramError, value: paramValue } = getSharedFileSchema.validate(req.params);
  if (paramError) {
    throw ApiErrors.ValidationError(paramError.details[0].message);
  }

  // Validate request body
  const { error: bodyError, value: bodyValue } = updateSharedFileSchema.validate(req.body);
  if (bodyError) {
    throw ApiErrors.ValidationError(bodyError.details[0].message);
  }

  const { id } = paramValue;
  const { access_type, expires_at } = bodyValue;

  try {
    // Check if shared file exists
    const existingFile = await query<SharedFile>(
      'SELECT * FROM shared_files WHERE id = $1',
      [id]
    );

    if (existingFile.rows.length === 0) {
      throw ApiErrors.NotFound('Shared file not found');
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
      throw ApiErrors.BadRequest('No valid fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query<SharedFile>(
      `UPDATE shared_files 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params
    );

    res.apiSuccess(result.rows[0], 'Shared file updated successfully');
  } catch (error) {
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('No valid fields'))) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to update shared file');
  }
}));

/**
 * DELETE /api/shared-files/:id
 * Revoke file sharing
 */
router.delete('/:id', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getSharedFileSchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { id } = value;

  try {
    const result = await query(
      'DELETE FROM shared_files WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw ApiErrors.NotFound('Shared file not found');
    }

    res.apiSuccess(
      { deleted: true },
      'File sharing revoked successfully'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to revoke file sharing');
  }
}));

/**
 * POST /api/shared-files/:id/access
 * Record file access (for analytics/tracking)
 */
router.post('/:id/access', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getSharedFileSchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { id } = value;

  try {
    // Check if shared file exists and is not expired
    const sharedFile = await query<SharedFile>(
      `SELECT * FROM shared_files 
       WHERE id = $1 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [id]
    );

    if (sharedFile.rows.length === 0) {
      throw ApiErrors.NotFound('Shared file not found or has expired');
    }

    // Update last accessed timestamp
    await query(
      'UPDATE shared_files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.apiSuccess(
      { recorded: true },
      'File access recorded successfully'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to record file access');
  }
}));

export default router;