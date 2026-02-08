/**
 * Integration Tests for Shared Files Routes
 * Tests all endpoints with authentication, validation, and error scenarios
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import sharedFilesRouter from '../../routes/sharedFiles';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';
import { generateToken } from '../../services/jwtService';
import { requireAuth } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/emailService');
jest.mock('../../services/analytics');
jest.mock('../../utils/creditOperations');

const mockQuery = jest.fn();
jest.mock('../../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockSendFileShareNotification = jest.fn();
jest.mock('../../services/emailService', () => ({
  sendFileShareNotification: (...args: any[]) => mockSendFileShareNotification(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../services/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    FILE_SHARED: 'file_shared',
  },
  AnalyticsCategory: {
    SHARING: 'sharing',
  },
  getFileSizeBucket: jest.fn((size: number) => '1MB-10MB'),
  getFileTypeCategory: jest.fn((mimeType: string) => 'document'),
}));

const mockCheckCredits = jest.fn();
const mockDeductCredits = jest.fn();
jest.mock('../../utils/creditOperations', () => ({
  checkCredits: (...args: any[]) => mockCheckCredits(...args),
  deductCredits: (...args: any[]) => mockDeductCredits(...args),
  COST_FILE_SHARE: 1.0,
  COST_EMAIL_NOTIFICATION: 0.5,
  TRANSACTION_TYPE: {
    FILE_SHARE: 'file_share',
  },
}));

describe('Shared Files Routes Integration', () => {
  let app: Application;
  const testUserEmail = 'sender@example.com';
  const testRecipientEmail = 'recipient@example.com';
  const testRecipientEmailHash = 'recipient-hash-456';
  const csrfToken = 'test-csrf-token';

  // Generate a token to extract the actual emailHash that will be used
  let testUserEmailHash: string;

  beforeAll(() => {
    // Generate token to get the actual emailHash
    const token = generateToken(testUserEmail);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    testUserEmailHash = decoded.emailHash;

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use(requireAuth);
    app.use('/api/shared-files', sharedFilesRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackEvent.mockResolvedValue(undefined);
    mockSendFileShareNotification.mockResolvedValue(undefined);
  });

  describe('POST /api/shared-files', () => {
    const validShareRequest = {
      file_id: 'file-123',
      recipient_user_id: testRecipientEmailHash,
      recipient_email: testRecipientEmail,
      encrypted_file_key: 'encrypted-key-data',
      file_name: 'document.pdf',
      file_size: 1024000,
      mime_type: 'application/pdf',
      access_type: 'view',
    };

    it('should create shared file with valid data and sufficient credits', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(9.0); // New balance after deduction

      // Mock check for existing share (none found)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Mock insert
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'share-uuid-123',
          ...validShareRequest,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.file_id).toBe(validShareRequest.file_id);
      expect(response.body.message).toBe('File shared successfully');

      // Verify credit check
      expect(mockCheckCredits).toHaveBeenCalledWith(testUserEmailHash, 1.0);

      // Verify existing share check
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM shared_files WHERE file_id = $1 AND recipient_user_id = $2',
        [validShareRequest.file_id, validShareRequest.recipient_user_id]
      );

      // Verify deduction
      expect(mockDeductCredits).toHaveBeenCalledWith(
        testUserEmailHash,
        1.0,
        'file_share',
        expect.objectContaining({
          file_id: validShareRequest.file_id,
          recipient_user_id: validShareRequest.recipient_user_id,
          email_sent: false,
        })
      );
    });

    it('should create shared file and send email when custom message provided', async () => {
      const token = generateToken(testUserEmail);
      const requestWithMessage = {
        ...validShareRequest,
        custom_message: 'Check out this file!',
      };

      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(8.5); // 1.0 + 0.5 = 1.5 deducted
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing share
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'share-uuid-123', ...requestWithMessage }],
      });

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(requestWithMessage);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify credit check for both share and email
      expect(mockCheckCredits).toHaveBeenCalledWith(testUserEmailHash, 1.5);

      // Verify email was sent
      expect(mockSendFileShareNotification).toHaveBeenCalledWith(
        testRecipientEmail,
        'Check out this file!'
      );

      // Verify deduction includes email cost
      expect(mockDeductCredits).toHaveBeenCalledWith(
        testUserEmailHash,
        1.5,
        'file_share',
        expect.objectContaining({
          email_sent: true,
        })
      );
    });

    it('should create shared file with expiration date', async () => {
      const token = generateToken(testUserEmail);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
      const requestWithExpiry = {
        ...validShareRequest,
        expires_at: expiresAt,
      };

      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(9.0);
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'share-uuid-123', ...requestWithExpiry }],
      });

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(requestWithExpiry);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app)
        .post('/api/shared-files')
        .send(validShareRequest);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when invalid token provided', async () => {
      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', ['zerodrive_token=invalid.token.here', `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(401);
    });

    it('should return 403 when CSRF token missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`])
        .send(validShareRequest);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('CSRF');
    });

    it('should return 403 when CSRF tokens do not match', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', 'wrong-csrf-token')
        .send(validShareRequest);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('CSRF');
    });

    it('should return 422 when required field file_id is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).file_id;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('file_id');
    });

    it('should return 422 when required field recipient_user_id is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).recipient_user_id;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('recipient_user_id');
    });

    it('should return 422 when required field encrypted_file_key is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).encrypted_file_key;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('encrypted_file_key');
    });

    it('should return 422 when required field file_name is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).file_name;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('file_name');
    });

    it('should return 422 when required field file_size is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).file_size;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('file_size');
    });

    it('should return 422 when required field mime_type is missing', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).mime_type;

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('mime_type');
    });

    it('should return 422 when file_size is negative', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        file_size: -100,
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 when file_size is not an integer', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        file_size: 1024.5,
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 when access_type is invalid', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        access_type: 'invalid-type',
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 when recipient_email format is invalid', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        recipient_email: 'not-an-email',
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 when custom_message exceeds max length', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        custom_message: 'a'.repeat(501), // Max is 500
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 when expires_at is not valid ISO date', async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        expires_at: 'not-a-date',
      };

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it('should return 402 when user has insufficient credits', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(402);
      expect(response.body.error.message).toContain('Insufficient credits');
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it('should return 409 when file is already shared with recipient', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(true);

      // Mock existing share found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-share-id' }],
      });

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('already shared');
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it('should return 500 on database error during share check', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(true);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to share file');
    });

    it('should return 500 on database error during insert', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(true);
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing share
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(500);
    });

    it('should handle email sending failure gracefully', async () => {
      const token = generateToken(testUserEmail);
      const requestWithMessage = {
        ...validShareRequest,
        custom_message: 'Check out this file!',
      };

      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(8.5);
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'share-uuid-123', ...requestWithMessage }],
      });
      mockSendFileShareNotification.mockRejectedValueOnce(new Error('Email service down'));

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(requestWithMessage);

      // Should still succeed even if email fails
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should default access_type to view when not specified', async () => {
      const token = generateToken(testUserEmail);
      const requestWithoutAccessType = { ...validShareRequest };
      delete (requestWithoutAccessType as any).access_type;

      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(9.0);
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'share-uuid-123', ...requestWithoutAccessType, access_type: 'view' }],
      });

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(requestWithoutAccessType);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle analytics tracking failure gracefully', async () => {
      const token = generateToken(testUserEmail);
      mockCheckCredits.mockResolvedValue(true);
      mockDeductCredits.mockResolvedValue(9.0);
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'share-uuid-123', ...validShareRequest }],
      });
      mockTrackEvent.mockRejectedValueOnce(new Error('Analytics service down'));

      const response = await request(app)
        .post('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(validShareRequest);

      // Should still succeed even if analytics fails
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/shared-files', () => {
    it('should retrieve shared files for recipient with pagination', async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFiles = [
        {
          id: 'share-1',
          file_id: 'file-1',
          recipient_user_id: testRecipientEmailHash,
          encrypted_file_key: 'key-1',
          file_name: 'doc1.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          access_type: 'view',
          created_at: new Date(),
        },
        {
          id: 'share-2',
          file_id: 'file-2',
          recipient_user_id: testRecipientEmailHash,
          encrypted_file_key: 'key-2',
          file_name: 'doc2.pdf',
          file_size: 2048,
          mime_type: 'application/pdf',
          access_type: 'download',
          created_at: new Date(),
        },
      ];

      // Mock count query - total of 100 files
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '100' }],
      });

      // Mock files query - returns 2 files (first page with default limit 50)
      mockQuery.mockResolvedValueOnce({
        rows: mockSharedFiles,
      });

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash, limit: 2, offset: 0 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(2);
      expect(response.body.data.total).toBe(100);
      expect(response.body.data.hasMore).toBe(true); // 0 + 2 < 100, so hasMore = true
      expect(response.body.message).toBe('Shared files retrieved successfully');
    });

    it('should use default pagination values when not specified', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [testRecipientEmailHash, 50, 0] // Default limit=50, offset=0
      );
    });

    it('should respect custom limit and offset', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/shared-files')
        .query({
          recipient_user_id: testRecipientEmailHash,
          limit: 20,
          offset: 40,
        })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [testRecipientEmailHash, 20, 40]
      );
    });

    it('should filter out expired files', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash })
        .set('Cookie', [`zerodrive_token=${token}`]);

      // Verify query includes expiration filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash });

      expect(response.status).toBe(401);
    });

    it('should return 422 when recipient_user_id is missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('recipient_user_id');
    });

    it('should return 422 when limit exceeds maximum', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash, limit: 101 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it('should return 422 when limit is less than 1', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash, limit: 0 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it('should return 422 when offset is negative', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash, offset: -1 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it('should return empty array when no files found', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.files).toEqual([]);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.hasMore).toBe(false);
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/shared-files')
        .query({ recipient_user_id: testRecipientEmailHash })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to retrieve shared files');
    });

    it('should calculate hasMore correctly when on last page', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/shared-files')
        .query({
          recipient_user_id: testRecipientEmailHash,
          limit: 50,
          offset: 0,
        })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.hasMore).toBe(false);
    });
  });

  describe('GET /api/shared-files/:id', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should retrieve specific shared file when exists and not expired', async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFile = {
        id: validUuid,
        file_id: 'file-123',
        recipient_user_id: testRecipientEmailHash,
        encrypted_file_key: 'key-data',
        file_name: 'document.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        access_type: 'view',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockSharedFile],
      });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validUuid);
      expect(response.body.message).toBe('Shared file retrieved successfully');
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app).get(`/api/shared-files/${validUuid}`);

      expect(response.status).toBe(401);
    });

    it('should return 422 when id is not valid UUID', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files/not-a-uuid')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain('must be a valid GUID');
    });

    it('should return 404 when shared file not found', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found or has expired');
    });

    it('should return 404 when shared file is expired', async () => {
      const token = generateToken(testUserEmail);
      // Query returns empty because it filters expired files
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to retrieve shared file');
    });

    it('should handle malformed UUID gracefully', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get('/api/shared-files/550e8400-invalid')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });
  });

  describe('PUT /api/shared-files/:id', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should update access_type successfully', async () => {
      const token = generateToken(testUserEmail);
      const updateRequest = {
        access_type: 'download',
      };

      // Mock existing file check
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: validUuid,
          file_id: 'file-123',
          access_type: 'view',
        }],
      });

      // Mock update
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: validUuid,
          file_id: 'file-123',
          access_type: 'download',
          updated_at: new Date(),
        }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.access_type).toBe('download');
      expect(response.body.message).toBe('Shared file updated successfully');
    });

    it('should update expires_at successfully', async () => {
      const token = generateToken(testUserEmail);
      const newExpiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const updateRequest = {
        expires_at: newExpiryDate,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: null }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: newExpiryDate }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update both access_type and expires_at', async () => {
      const token = generateToken(testUserEmail);
      const newExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const updateRequest = {
        access_type: 'download',
        expires_at: newExpiryDate,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: validUuid,
          access_type: 'download',
          expires_at: newExpiryDate,
        }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow setting expires_at to null', async () => {
      const token = generateToken(testUserEmail);
      const updateRequest = {
        expires_at: null,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: null }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .send({ access_type: 'download' });

      expect(response.status).toBe(401);
    });

    it('should return 403 when CSRF token missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`])
        .send({ access_type: 'download' });

      expect(response.status).toBe(403);
    });

    it('should return 422 when id is not valid UUID', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put('/api/shared-files/not-a-uuid')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ access_type: 'download' });

      expect(response.status).toBe(422);
    });

    it('should return 422 when access_type is invalid', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ access_type: 'invalid-type' });

      expect(response.status).toBe(422);
    });

    it('should return 400 when no valid fields to update', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('No valid fields to update');
    });

    it('should return 404 when shared file not found', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ access_type: 'download' });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ access_type: 'download' });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to update shared file');
    });
  });

  describe('DELETE /api/shared-files/:id', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should delete shared file successfully', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.message).toBe('File sharing revoked successfully');
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM shared_files WHERE id = $1',
        [validUuid]
      );
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app).delete(`/api/shared-files/${validUuid}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when CSRF token missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(403);
    });

    it('should return 403 when CSRF tokens do not match', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', 'wrong-csrf-token');

      expect(response.status).toBe(403);
    });

    it('should return 422 when id is not valid UUID', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete('/api/shared-files/not-a-uuid')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(422);
    });

    it('should return 404 when shared file not found', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found');
    });

    it('should handle double deletion gracefully', async () => {
      const token = generateToken(testUserEmail);

      // First deletion succeeds
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const response1 = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);
      expect(response1.status).toBe(200);

      // Second deletion fails (already deleted)
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      const response2 = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);
      expect(response2.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to revoke file sharing');
    });
  });

  describe('POST /api/shared-files/:id/access', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should record file access successfully', async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFile = {
        id: validUuid,
        file_id: 'file-123',
        file_name: 'document.pdf',
      };

      // Mock file exists check
      mockQuery.mockResolvedValueOnce({
        rows: [mockSharedFile],
      });

      // Mock update last_accessed_at
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recorded).toBe(true);
      expect(response.body.message).toBe('File access recorded successfully');

      // Verify update was called
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE shared_files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [validUuid]
      );
    });

    it('should return 401 when no auth cookie provided', async () => {
      const response = await request(app).post(`/api/shared-files/${validUuid}/access`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when CSRF token missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(403);
    });

    it('should return 422 when id is not valid UUID', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/shared-files/not-a-uuid/access')
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(422);
    });

    it('should return 404 when shared file not found', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('not found or has expired');
    });

    it('should return 404 when shared file is expired', async () => {
      const token = generateToken(testUserEmail);
      // Query returns empty because file is expired
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(404);
    });

    it('should filter expired files in query', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      // Verify query includes expiration filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });

    it('should return 500 on database error during file check', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to record file access');
    });

    it('should return 500 on database error during update', async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);

      expect(response.status).toBe(500);
    });

    it('should handle multiple access recordings', async () => {
      const token = generateToken(testUserEmail);

      // First access
      mockQuery.mockResolvedValueOnce({ rows: [{ id: validUuid }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response1 = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);
      expect(response1.status).toBe(200);

      // Second access
      mockQuery.mockResolvedValueOnce({ rows: [{ id: validUuid }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response2 = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set('Cookie', [`zerodrive_token=${token}`, `zerodrive_csrf=${csrfToken}`])
        .set('x-csrf-token', csrfToken);
      expect(response2.status).toBe(200);

      // Both should succeed
      expect(mockQuery).toHaveBeenCalledTimes(4); // 2 checks + 2 updates
    });
  });
});
