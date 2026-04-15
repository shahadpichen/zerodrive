/**
 * Public Keys Routes (TypeScript)
 */

import { Router } from 'express';
import Joi from 'joi';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiErrors } from '../middleware/errorHandler';
import { Request, Response } from 'express';
import { PublicKey, CreatePublicKeyRequest, GetPublicKeyRequest } from '../types';

const router = Router();

// Validation schemas
const createPublicKeySchema = Joi.object({
  user_id: Joi.string().required(),
  public_key: Joi.string().required()
});

const getUserPublicKeySchema = Joi.object({
  user_id: Joi.string().required()
});

/**
 * POST /api/public-keys
 * Store a user's public key
 */
router.post('/', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request body
  const { error, value } = createPublicKeySchema.validate(req.body);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { user_id, public_key } = value;

  try {
    // Check if public key already exists for this user
    const existingKey = await query<PublicKey>(
      'SELECT * FROM public_keys WHERE user_id = $1',
      [user_id]
    );

    if (existingKey.rows.length > 0) {
      // Update existing public key
      const result = await query<PublicKey>(
        `UPDATE public_keys 
         SET public_key = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 
         RETURNING *`,
        [user_id, public_key]
      );

      res.apiSuccess(result.rows[0], 'Public key updated successfully');
    } else {
      // Create new public key record
      const result = await query<PublicKey>(
        `INSERT INTO public_keys (user_id, public_key) 
         VALUES ($1, $2) 
         RETURNING *`,
        [user_id, public_key]
      );

      res.apiSuccess(result.rows[0], 'Public key stored successfully', 201);
    }
  } catch (error) {
    throw ApiErrors.InternalServer('Failed to store public key');
  }
}));

/**
 * GET /api/public-keys/:user_id
 * Get a user's public key
 */
router.get('/:user_id', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getUserPublicKeySchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { user_id } = value;

  try {
    const result = await query<PublicKey>(
      'SELECT public_key FROM public_keys WHERE user_id = $1',
      [user_id]
    );

    if (result.rows.length === 0) {
      throw ApiErrors.NotFound('Public key not found for this user');
    }

    res.apiSuccess(
      { public_key: result.rows[0].public_key },
      'Public key retrieved successfully'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to retrieve public key');
  }
}));

/**
 * GET /api/public-keys
 * Get all public keys (for testing/admin purposes)
 */
router.get('/', asyncHandler(async (
  req: Request,
  res: Response
) => {
  try {
    const result = await query<PublicKey>(
      'SELECT * FROM public_keys ORDER BY created_at DESC'
    );

    res.apiSuccess(result.rows, 'Public keys retrieved successfully');
  } catch (error) {
    throw ApiErrors.InternalServer('Failed to retrieve public keys');
  }
}));

/**
 * DELETE /api/public-keys/:user_id
 * Delete a user's public key
 */
router.delete('/:user_id', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request parameters
  const { error, value } = getUserPublicKeySchema.validate(req.params);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { user_id } = value;

  try {
    const result = await query(
      'DELETE FROM public_keys WHERE user_id = $1',
      [user_id]
    );

    if (result.rowCount === 0) {
      throw ApiErrors.NotFound('Public key not found for this user');
    }

    res.apiSuccess(
      { deleted: true },
      'Public key deleted successfully'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw ApiErrors.InternalServer('Failed to delete public key');
  }
}));

export default router;