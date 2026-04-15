/**
 * Integration Tests for Health & Info Routes
 * Tests public health check and API information endpoints
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import indexRouter from '../../routes/index';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';

// Mock the auth middleware to allow testing without authentication
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));

// Mock all protected route modules
jest.mock('../../routes/publicKeys', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/sharedFiles', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/presignedUrls', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/crypto', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/invitations', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/analytics', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/credits', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/webhooks', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});
jest.mock('../../routes/auth', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});

describe('Health & Info Routes Integration', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use('/api', indexRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/health', () => {
    it('should return 200 and healthy status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API is healthy');
    });

    it('should include status field with "healthy" value', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('healthy');
    });

    it('should include valid ISO timestamp', async () => {
      const beforeRequest = new Date();
      const response = await request(app).get('/api/health');
      const afterRequest = new Date();

      expect(response.body.data.timestamp).toBeDefined();
      const timestamp = new Date(response.body.data.timestamp);

      expect(timestamp.toISOString()).toBe(response.body.data.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should include version from environment or default', async () => {
      process.env.npm_package_version = '2.5.1';

      const response = await request(app).get('/api/health');

      expect(response.body.data.version).toBe('2.5.1');
    });

    it('should use default version when npm_package_version not set', async () => {
      delete process.env.npm_package_version;

      const response = await request(app).get('/api/health');

      expect(response.body.data.version).toBe('1.0.0');
    });

    it('should not require authentication', async () => {
      // No auth cookie provided
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
    });

    it('should handle multiple concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('healthy');
      });
    });

    it('should return consistent structure on repeated calls', async () => {
      const response1 = await request(app).get('/api/health');
      const response2 = await request(app).get('/api/health');

      expect(response1.body.success).toBe(response2.body.success);
      expect(response1.body.message).toBe(response2.body.message);
      expect(response1.body.data.status).toBe(response2.body.data.status);
      expect(response1.body.data.version).toBe(response2.body.data.version);
    });

    it('should accept query parameters without error', async () => {
      const response = await request(app)
        .get('/api/health')
        .query({ foo: 'bar', test: '123' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should accept request headers without error', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('X-Custom-Header', 'test-value')
        .set('User-Agent', 'Health-Check-Bot/1.0');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('GET /api/', () => {
    it('should return 200 and API information', async () => {
      const response = await request(app).get('/api/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ZeroDrive Backend API');
    });

    it('should include API name and description', async () => {
      const response = await request(app).get('/api/');

      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('ZeroDrive Backend API');
      expect(response.body.data.description).toBe('End-to-end encrypted file storage backend');
    });

    it('should include version from environment or default', async () => {
      process.env.npm_package_version = '3.2.1';

      const response = await request(app).get('/api/');

      expect(response.body.data.version).toBe('3.2.1');
    });

    it('should use default version when npm_package_version not set', async () => {
      delete process.env.npm_package_version;

      const response = await request(app).get('/api/');

      expect(response.body.data.version).toBe('1.0.0');
    });

    it('should include endpoints object', async () => {
      const response = await request(app).get('/api/');

      expect(response.body.data.endpoints).toBeDefined();
      expect(typeof response.body.data.endpoints).toBe('object');
    });

    it('should list all major API endpoints', async () => {
      const response = await request(app).get('/api/');

      const endpoints = response.body.data.endpoints;

      // Health endpoints
      expect(endpoints['GET /api/health']).toBeDefined();

      // Auth endpoints
      expect(endpoints['GET /api/auth/google']).toBeDefined();
      expect(endpoints['GET /api/auth/google/callback']).toBeDefined();
      expect(endpoints['GET /api/auth/me']).toBeDefined();
      expect(endpoints['POST /api/auth/logout']).toBeDefined();

      // Public keys
      expect(endpoints['POST /api/public-keys']).toBeDefined();
      expect(endpoints['GET /api/public-keys/:user_id']).toBeDefined();

      // Shared files
      expect(endpoints['POST /api/shared-files']).toBeDefined();
      expect(endpoints['GET /api/shared-files']).toBeDefined();
      expect(endpoints['GET /api/shared-files/:id']).toBeDefined();
      expect(endpoints['PUT /api/shared-files/:id']).toBeDefined();
      expect(endpoints['DELETE /api/shared-files/:id']).toBeDefined();

      // Presigned URLs
      expect(endpoints['POST /api/presigned-url/upload']).toBeDefined();
      expect(endpoints['POST /api/presigned-url/download']).toBeDefined();

      // Crypto
      expect(endpoints['POST /api/crypto/hash-email']).toBeDefined();

      // Webhooks
      expect(endpoints['POST /api/webhooks/mailgun']).toBeDefined();
      expect(endpoints['GET /api/webhooks/mailgun/health']).toBeDefined();

      // Invitations
      expect(endpoints['POST /api/invitations/send']).toBeDefined();
      expect(endpoints['GET /api/invitations/rate-limit/:email']).toBeDefined();

      // Analytics
      expect(endpoints['GET /api/analytics/summary']).toBeDefined();
      expect(endpoints['GET /api/analytics/daily']).toBeDefined();

      // Credits
      expect(endpoints['GET /api/credits/balance/:userId']).toBeDefined();
      expect(endpoints['GET /api/credits/transactions/:userId']).toBeDefined();
    });

    it('should have descriptive endpoint documentation', async () => {
      const response = await request(app).get('/api/');

      const endpoints = response.body.data.endpoints;

      expect(endpoints['GET /api/health']).toBe('Health check');
      expect(endpoints['POST /api/shared-files']).toBe('Share a file');
      expect(endpoints['POST /api/webhooks/mailgun']).toBe('Mailgun webhook endpoint');
    });

    it('should not require authentication', async () => {
      // No auth cookie provided
      const response = await request(app).get('/api/');

      expect(response.status).toBe(200);
    });

    it('should return valid JSON structure', async () => {
      const response = await request(app).get('/api/');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).toHaveProperty('endpoints');
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe('ZeroDrive Backend API');
      });
    });

    it('should accept query parameters without error', async () => {
      const response = await request(app)
        .get('/api/')
        .query({ format: 'json' });

      expect(response.status).toBe(200);
    });

    it('should return consistent data structure', async () => {
      const response1 = await request(app).get('/api/');
      const response2 = await request(app).get('/api/');

      expect(response1.body.data.name).toBe(response2.body.data.name);
      expect(response1.body.data.description).toBe(response2.body.data.description);
      expect(Object.keys(response1.body.data.endpoints).length).toBe(
        Object.keys(response2.body.data.endpoints).length
      );
    });

    it('should handle trailing slash', async () => {
      const response = await request(app).get('/api/');

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('ZeroDrive Backend API');
    });

    it('should work with different Accept headers', async () => {
      const response = await request(app)
        .get('/api/')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid routes under /api', async () => {
      const response = await request(app).get('/api/invalid-route');

      expect(response.status).toBe(404);
    });

    it('should handle /api/health with trailing slash', async () => {
      const response = await request(app).get('/api/health/');

      // Express accepts trailing slash and returns success
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should differentiate between health and root endpoint', async () => {
      const healthResponse = await request(app).get('/api/health');
      const rootResponse = await request(app).get('/api/');

      expect(healthResponse.body.message).toBe('API is healthy');
      expect(rootResponse.body.message).toBe('ZeroDrive Backend API');
      expect(healthResponse.body.data.status).toBe('healthy');
      expect(rootResponse.body.data.name).toBeDefined();
    });

    it('should handle HEAD request to health endpoint', async () => {
      const response = await request(app).head('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should handle HEAD request to root endpoint', async () => {
      const response = await request(app).head('/api/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should reject POST to health endpoint', async () => {
      const response = await request(app).post('/api/health');

      expect(response.status).toBe(404);
    });

    it('should reject POST to root info endpoint', async () => {
      const response = await request(app).post('/api/');

      expect(response.status).toBe(404);
    });
  });

  describe('Version Handling', () => {
    it('should handle semantic version format', async () => {
      process.env.npm_package_version = '10.20.30';

      const response = await request(app).get('/api/health');

      expect(response.body.data.version).toBe('10.20.30');
      expect(response.body.data.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should handle pre-release version', async () => {
      process.env.npm_package_version = '1.0.0-alpha.1';

      const response = await request(app).get('/api/health');

      expect(response.body.data.version).toBe('1.0.0-alpha.1');
    });

    it('should handle version with build metadata', async () => {
      process.env.npm_package_version = '1.0.0+build.123';

      const response = await request(app).get('/api/health');

      expect(response.body.data.version).toBe('1.0.0+build.123');
    });

    it('should handle empty version string', async () => {
      process.env.npm_package_version = '';

      const response = await request(app).get('/api/health');

      // Falls back to default
      expect(response.body.data.version).toBe('1.0.0');
    });
  });
});
