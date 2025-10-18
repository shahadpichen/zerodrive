/**
 * Routes Index (TypeScript)
 */

import { Router } from 'express';
import publicKeysRouter from './publicKeys';
import sharedFilesRouter from './sharedFiles';
import presignedUrlsRouter from './presignedUrls';

const router = Router();

// Mount route modules
router.use('/public-keys', publicKeysRouter);
router.use('/shared-files', sharedFilesRouter);
router.use('/presigned-url', presignedUrlsRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.apiSuccess({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  }, 'API is healthy');
});

// API info endpoint
router.get('/', (req, res) => {
  res.apiSuccess({
    name: 'ZeroDrive Backend API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'End-to-end encrypted file storage backend',
    endpoints: {
      'GET /api/health': 'Health check',
      'POST /api/public-keys': 'Store user public key',
      'GET /api/public-keys/:user_id': 'Get user public key',
      'POST /api/shared-files': 'Share a file',
      'GET /api/shared-files': 'Get shared files',
      'GET /api/shared-files/:id': 'Get specific shared file',
      'PUT /api/shared-files/:id': 'Update shared file',
      'DELETE /api/shared-files/:id': 'Revoke file sharing',
      'POST /api/presigned-url/upload': 'Generate pre-signed upload URL',
      'POST /api/presigned-url/download': 'Generate pre-signed download URL'
    }
  }, 'ZeroDrive Backend API');
});

export default router;