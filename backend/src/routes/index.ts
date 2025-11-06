/**
 * Routes Index (TypeScript)
 */

import { Router } from 'express';
import authRouter from './auth';
import publicKeysRouter from './publicKeys';
import sharedFilesRouter from './sharedFiles';
import presignedUrlsRouter from './presignedUrls';
import cryptoRouter from './crypto';
import webhooksRouter from './webhooks';
import invitationsRouter from './invitations';
import analyticsRouter from './analytics';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Health check endpoint (public)
router.get('/health', (req, res) => {
  res.apiSuccess({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  }, 'API is healthy');
});

// API info endpoint (public)
router.get('/', (req, res) => {
  res.apiSuccess({
    name: 'ZeroDrive Backend API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'End-to-end encrypted file storage backend',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/auth/google': 'Initiate Google OAuth',
      'GET /api/auth/google/callback': 'OAuth callback',
      'GET /api/auth/me': 'Get current user',
      'POST /api/auth/logout': 'Logout',
      'POST /api/public-keys': 'Store user public key',
      'GET /api/public-keys/:user_id': 'Get user public key',
      'POST /api/shared-files': 'Share a file',
      'GET /api/shared-files': 'Get shared files',
      'GET /api/shared-files/:id': 'Get specific shared file',
      'PUT /api/shared-files/:id': 'Update shared file',
      'DELETE /api/shared-files/:id': 'Revoke file sharing',
      'POST /api/presigned-url/upload': 'Generate pre-signed upload URL',
      'POST /api/presigned-url/download': 'Generate pre-signed download URL',
      'POST /api/crypto/hash-email': 'Hash email with server-side salt',
      'POST /api/webhooks/mailgun': 'Mailgun webhook endpoint',
      'GET /api/webhooks/mailgun/health': 'Webhook health check',
      'POST /api/invitations/send': 'Send invitation email to unregistered user',
      'GET /api/invitations/rate-limit/:email': 'Check rate limit status',
      'GET /api/analytics/summary': 'Get anonymous analytics summary',
      'GET /api/analytics/daily': 'Get daily analytics stats'
    }
  }, 'ZeroDrive Backend API');
});

// Mount auth routes (public, no auth required)
router.use('/auth', authRouter);

// Mount webhook routes (public, external services)
router.use('/webhooks', webhooksRouter);

// Apply authentication middleware to all routes below this point
router.use(requireAuth);

// Mount protected route modules
router.use('/public-keys', publicKeysRouter);
router.use('/shared-files', sharedFilesRouter);
router.use('/presigned-url', presignedUrlsRouter);
router.use('/crypto', cryptoRouter);
router.use('/invitations', invitationsRouter);
router.use('/analytics', analyticsRouter);

export default router;