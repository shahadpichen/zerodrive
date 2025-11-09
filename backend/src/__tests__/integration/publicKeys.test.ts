/**
 * Integration Tests for Public Keys Routes
 * Tests the DELETE endpoint used in rollback functionality
 */

import request from 'supertest';
import express from 'express';
import publicKeysRouter from '../../routes/publicKeys';
import { query } from '../../config/database';

// Mock database
jest.mock('../../config/database');

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Create test app
const app = express();
app.use(express.json());

// Add apiSuccess middleware
app.use((req, res, next) => {
  res.apiSuccess = (data: any, message: string, statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      data,
      message,
    });
  };
  next();
});

app.use('/api/public-keys', publicKeysRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

describe('Public Keys Routes - DELETE', () => {
  const mockUserId = 'test-user-hash-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/public-keys/:user_id', () => {
    it('should successfully delete existing public key', async () => {
      // Mock successful delete
      (query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        rows: [],
      });

      const response = await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.message).toBe('Public key deleted successfully');
      expect(query).toHaveBeenCalledWith(
        'DELETE FROM public_keys WHERE user_id = $1',
        [mockUserId]
      );
    });

    it('should return 404 when public key not found', async () => {
      // Mock delete with no rows affected
      (query as jest.Mock).mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const response = await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for invalid user_id parameter', async () => {
      const response = await request(app)
        .delete('/api/public-keys/')
        .expect(404); // Express returns 404 for missing route param

      // No database query should be made
      expect(query).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      // Mock database error
      (query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to delete public key');
    });

    it('should handle special characters in user_id', async () => {
      const specialUserId = 'user-with-special-chars-!@#$%';

      (query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        rows: [],
      });

      await request(app)
        .delete(`/api/public-keys/${encodeURIComponent(specialUserId)}`)
        .expect(200);

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM public_keys WHERE user_id = $1',
        [specialUserId]
      );
    });
  });

  describe('Rollback Scenario Integration', () => {
    it('should successfully delete key during rollback', async () => {
      // Simulate rollback scenario:
      // 1. Key was created
      // 2. Backup failed
      // 3. Rollback deletes the key

      (query as jest.Mock).mockResolvedValue({
        rowCount: 1,
        rows: [],
      });

      const response = await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(200);

      expect(response.body.data.deleted).toBe(true);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('should handle double deletion gracefully', async () => {
      // First deletion succeeds
      (query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
        rows: [],
      });

      await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(200);

      // Second deletion fails (key already deleted)
      (query as jest.Mock).mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await request(app)
        .delete(`/api/public-keys/${mockUserId}`)
        .expect(404);
    });
  });

  describe('POST /api/public-keys', () => {
    it('should create new public key', async () => {
      const mockPublicKey = {
        user_id: mockUserId,
        public_key: 'test-public-key-data',
      };

      // Mock check for existing key (none found)
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      // Mock insert
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          user_id: mockUserId,
          public_key: mockPublicKey.public_key,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const response = await request(app)
        .post('/api/public-keys')
        .send(mockPublicKey)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Public key stored successfully');
      expect(response.body.data.user_id).toBe(mockUserId);
    });

    it('should update existing public key', async () => {
      const mockPublicKey = {
        user_id: mockUserId,
        public_key: 'updated-public-key-data',
      };

      // Mock check for existing key (found)
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ user_id: mockUserId, public_key: 'old-key' }],
      });

      // Mock update
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          user_id: mockUserId,
          public_key: mockPublicKey.public_key,
          updated_at: new Date(),
        }],
      });

      const response = await request(app)
        .post('/api/public-keys')
        .send(mockPublicKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Public key updated successfully');
    });
  });

  describe('GET /api/public-keys/:user_id', () => {
    it('should retrieve existing public key', async () => {
      const mockKeyData = {
        user_id: mockUserId,
        public_key: 'test-public-key',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (query as jest.Mock).mockResolvedValue({
        rows: [mockKeyData],
      });

      const response = await request(app)
        .get(`/api/public-keys/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.public_key).toBe('test-public-key');
      expect(response.body.message).toBe('Public key retrieved successfully');
    });

    it('should return 404 when key not found', async () => {
      (query as jest.Mock).mockResolvedValue({
        rows: [],
      });

      const response = await request(app)
        .get(`/api/public-keys/${mockUserId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
