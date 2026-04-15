import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';

const router = express.Router();

/**
 * POST /api/crypto/hash-email
 * Hash an email address with server-side salt
 * This prevents rainbow table attacks by using a server-side secret salt
 */
router.post(
  '/hash-email',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
            details: errors.array(),
          },
        });
      }

      const { email } = req.body;

      // Get salt from environment
      const salt = process.env.EMAIL_HASH_SALT;
      if (!salt) {
        console.error('EMAIL_HASH_SALT not configured in environment');
        return res.status(500).json({
          success: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Server configuration error',
          },
        });
      }

      // Hash email with salt using SHA-256
      const hash = crypto
        .createHash('sha256')
        .update(email.toLowerCase().trim() + salt)
        .digest('hex');

      return res.status(200).json({
        success: true,
        data: {
          hashedEmail: hash,
        },
      });
    } catch (error) {
      console.error('Error hashing email:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to hash email',
        },
      });
    }
  }
);

export default router;
