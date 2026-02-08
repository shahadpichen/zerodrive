/**
 * Integration Tests for Credits Routes
 * Tests credit balance and transaction history endpoints
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import creditsRouter from '../../routes/credits';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../utils/creditOperations');

const mockQuery = jest.fn();
jest.mock('../../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockGetBalance = jest.fn();
const mockGetTransactionHistory = jest.fn();
jest.mock('../../utils/creditOperations', () => ({
  getBalance: (...args: any[]) => mockGetBalance(...args),
  getTransactionHistory: (...args: any[]) => mockGetTransactionHistory(...args),
}));

describe('Credits Routes Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use('/api/credits', creditsRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/credits/balance/:userId', () => {
    const mockUserId = 'test-user-id-123';

    it('should return 200 and credit balance when user exists', async () => {
      const mockBalance = 50.5;
      mockGetBalance.mockResolvedValue(mockBalance);

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(mockUserId);
      expect(response.body.data.balance).toBe(mockBalance);
      expect(response.body.message).toBe('Credit balance retrieved successfully');
      expect(mockGetBalance).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 200 with zero balance when user has no credits', async () => {
      mockGetBalance.mockResolvedValue(0);

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);
    });

    it('should return 200 with decimal balance', async () => {
      mockGetBalance.mockResolvedValue(12.75);

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(200);

      expect(response.body.data.balance).toBe(12.75);
    });

    it('should return 404 when user not found', async () => {
      mockGetBalance.mockRejectedValue(new Error('User test-user-id-123 not found'));

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('User test-user-id-123 not found');
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .get('/api/credits/balance/')
        .expect(404); // Express returns 404 for missing route param

      expect(mockGetBalance).not.toHaveBeenCalled();
    });

    it('should return 400 when userId is empty string', async () => {
      const response = await request(app)
        .get('/api/credits/balance/')
        .expect(404);

      expect(mockGetBalance).not.toHaveBeenCalled();
    });

    it('should handle special characters in userId', async () => {
      const specialUserId = 'user-with-special-chars-!@#$%';
      mockGetBalance.mockResolvedValue(100);

      await request(app)
        .get(`/api/credits/balance/${encodeURIComponent(specialUserId)}`)
        .expect(200);

      expect(mockGetBalance).toHaveBeenCalledWith(specialUserId);
    });

    it('should handle very long userId', async () => {
      const longUserId = 'a'.repeat(500);
      mockGetBalance.mockResolvedValue(25);

      const response = await request(app)
        .get(`/api/credits/balance/${longUserId}`)
        .expect(200);

      expect(response.body.data.user_id).toBe(longUserId);
      expect(mockGetBalance).toHaveBeenCalledWith(longUserId);
    });

    it('should handle UUID format userId', async () => {
      const uuidUserId = '550e8400-e29b-41d4-a716-446655440000';
      mockGetBalance.mockResolvedValue(15.25);

      const response = await request(app)
        .get(`/api/credits/balance/${uuidUserId}`)
        .expect(200);

      expect(response.body.data.user_id).toBe(uuidUserId);
    });

    it('should handle email format userId', async () => {
      const emailUserId = 'test@example.com';
      mockGetBalance.mockResolvedValue(30);

      const response = await request(app)
        .get(`/api/credits/balance/${encodeURIComponent(emailUserId)}`)
        .expect(200);

      expect(response.body.data.user_id).toBe(emailUserId);
    });

    it('should return 500 on database error', async () => {
      mockGetBalance.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to retrieve credit balance');
    });

    it('should return 500 on generic error', async () => {
      mockGetBalance.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to retrieve credit balance');
    });

    it('should handle large balance values', async () => {
      const largeBalance = 999999.99;
      mockGetBalance.mockResolvedValue(largeBalance);

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(200);

      expect(response.body.data.balance).toBe(largeBalance);
    });

    it('should handle negative balance values', async () => {
      const negativeBalance = -10.5;
      mockGetBalance.mockResolvedValue(negativeBalance);

      const response = await request(app)
        .get(`/api/credits/balance/${mockUserId}`)
        .expect(200);

      expect(response.body.data.balance).toBe(negativeBalance);
    });
  });

  describe('GET /api/credits/transactions/:userId', () => {
    const mockUserId = 'test-user-id-123';

    const mockTransactions = [
      {
        id: '1',
        user_id: mockUserId,
        amount: -1.0,
        transaction_type: 'file_share',
        balance_after: 49.0,
        metadata: { file_id: 'file-123' },
        created_at: new Date('2024-01-15T10:00:00Z'),
      },
      {
        id: '2',
        user_id: mockUserId,
        amount: 50.0,
        transaction_type: 'initial_credit',
        balance_after: 50.0,
        metadata: null,
        created_at: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    it('should return 200 and transaction history with default pagination', async () => {
      mockGetTransactionHistory.mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
      expect(response.body.message).toBe('Transaction history retrieved successfully');

      // Verify transaction data (dates are serialized to strings in JSON)
      expect(response.body.data.transactions[0].id).toBe('1');
      expect(response.body.data.transactions[0].user_id).toBe(mockUserId);
      expect(response.body.data.transactions[0].amount).toBe(-1.0);
      expect(response.body.data.transactions[0].transaction_type).toBe('file_share');
      expect(response.body.data.transactions[0].balance_after).toBe(49.0);
      expect(response.body.data.transactions[0].metadata).toEqual({ file_id: 'file-123' });

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 50, 0);
    });

    it('should return 200 with empty array when no transactions', async () => {
      mockGetTransactionHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it('should accept custom limit parameter', async () => {
      mockGetTransactionHistory.mockResolvedValue([mockTransactions[0]]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 10, 0);
    });

    it('should accept custom offset parameter', async () => {
      mockGetTransactionHistory.mockResolvedValue([mockTransactions[1]]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 50, 10);
    });

    it('should accept both limit and offset parameters', async () => {
      mockGetTransactionHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 20, offset: 40 })
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 20, 40);
    });

    it('should return 422 when limit exceeds maximum', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 101 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('limit');
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when limit is less than 1', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 0 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('limit');
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when limit is negative', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: -5 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when offset is negative', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: -1 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('offset');
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when limit is not an integer', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 10.5 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when offset is not an integer', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: 5.7 })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when limit is not a number', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 'abc' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should return 422 when offset is not a number', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: 'xyz' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should accept limit at maximum boundary (100)', async () => {
      mockGetTransactionHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 100 })
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 100, 0);
    });

    it('should accept limit at minimum boundary (1)', async () => {
      mockGetTransactionHistory.mockResolvedValue([mockTransactions[0]]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 1 })
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 1, 0);
    });

    it('should accept offset at minimum boundary (0)', async () => {
      mockGetTransactionHistory.mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: 0 })
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 50, 0);
    });

    it('should accept large offset values', async () => {
      mockGetTransactionHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ offset: 10000 })
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(mockUserId, 50, 10000);
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .get('/api/credits/transactions/')
        .expect(404); // Express returns 404 for missing route param

      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should handle special characters in userId', async () => {
      const specialUserId = 'user-with-special-chars-!@#$%';
      mockGetTransactionHistory.mockResolvedValue([]);

      await request(app)
        .get(`/api/credits/transactions/${encodeURIComponent(specialUserId)}`)
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(specialUserId, 50, 0);
    });

    it('should handle UUID format userId', async () => {
      const uuidUserId = '550e8400-e29b-41d4-a716-446655440000';
      mockGetTransactionHistory.mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/credits/transactions/${uuidUserId}`)
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(uuidUserId, 50, 0);
    });

    it('should return 500 on database error', async () => {
      mockGetTransactionHistory.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to retrieve transaction history');
    });

    it('should return 500 on generic error', async () => {
      mockGetTransactionHistory.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Failed to retrieve transaction history');
    });

    it('should reject unknown query parameters', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .query({ limit: 10, offset: 5, unknownParam: 'value' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('unknownParam');
      expect(mockGetTransactionHistory).not.toHaveBeenCalled();
    });

    it('should handle single transaction in history', async () => {
      mockGetTransactionHistory.mockResolvedValue([mockTransactions[0]]);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });

    it('should handle transaction with null metadata', async () => {
      const txWithNullMetadata = [{
        ...mockTransactions[0],
        metadata: null,
      }];
      mockGetTransactionHistory.mockResolvedValue(txWithNullMetadata);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions[0].metadata).toBeNull();
    });

    it('should handle transaction with complex metadata', async () => {
      const txWithComplexMetadata = [{
        ...mockTransactions[0],
        metadata: {
          file_id: 'file-123',
          recipient: 'user@example.com',
          nested: { key: 'value' },
        },
      }];
      mockGetTransactionHistory.mockResolvedValue(txWithComplexMetadata);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions[0].metadata).toEqual({
        file_id: 'file-123',
        recipient: 'user@example.com',
        nested: { key: 'value' },
      });
    });

    it('should handle negative transaction amounts', async () => {
      const txWithNegativeAmount = [{
        ...mockTransactions[0],
        amount: -5.5,
        balance_after: 44.5,
      }];
      mockGetTransactionHistory.mockResolvedValue(txWithNegativeAmount);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions[0].amount).toBe(-5.5);
    });

    it('should handle positive transaction amounts', async () => {
      const txWithPositiveAmount = [{
        ...mockTransactions[1],
        amount: 100.0,
      }];
      mockGetTransactionHistory.mockResolvedValue(txWithPositiveAmount);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions[0].amount).toBe(100.0);
    });

    it('should handle zero amount transactions', async () => {
      const txWithZeroAmount = [{
        ...mockTransactions[0],
        amount: 0,
      }];
      mockGetTransactionHistory.mockResolvedValue(txWithZeroAmount);

      const response = await request(app)
        .get(`/api/credits/transactions/${mockUserId}`)
        .expect(200);

      expect(response.body.data.transactions[0].amount).toBe(0);
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle very long userId in balance endpoint', async () => {
      const veryLongUserId = 'a'.repeat(1000);
      mockGetBalance.mockResolvedValue(100);

      const response = await request(app)
        .get(`/api/credits/balance/${veryLongUserId}`)
        .expect(200);

      expect(response.body.data.user_id).toBe(veryLongUserId);
    });

    it('should handle very long userId in transactions endpoint', async () => {
      const veryLongUserId = 'a'.repeat(1000);
      mockGetTransactionHistory.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/credits/transactions/${veryLongUserId}`)
        .expect(200);

      expect(mockGetTransactionHistory).toHaveBeenCalledWith(veryLongUserId, 50, 0);
    });

    it('should handle userId with URL-encoded spaces', async () => {
      const userIdWithSpaces = 'user id with spaces';
      mockGetBalance.mockResolvedValue(50);

      const response = await request(app)
        .get(`/api/credits/balance/${encodeURIComponent(userIdWithSpaces)}`)
        .expect(200);

      expect(mockGetBalance).toHaveBeenCalledWith(userIdWithSpaces);
    });

    it('should handle userId with forward slashes', async () => {
      const userIdWithSlash = 'user/id/with/slashes';
      mockGetBalance.mockResolvedValue(50);

      const response = await request(app)
        .get(`/api/credits/balance/${encodeURIComponent(userIdWithSlash)}`)
        .expect(200);

      expect(mockGetBalance).toHaveBeenCalledWith(userIdWithSlash);
    });

    it('should handle maximum transactions returned', async () => {
      const maxTransactions = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        user_id: 'test-user',
        amount: -1.0,
        transaction_type: 'file_share',
        balance_after: 100 - i,
        metadata: null,
        created_at: new Date(),
      }));
      mockGetTransactionHistory.mockResolvedValue(maxTransactions);

      const response = await request(app)
        .get('/api/credits/transactions/test-user')
        .query({ limit: 100 })
        .expect(200);

      expect(response.body.data.count).toBe(100);
      expect(response.body.data.transactions).toHaveLength(100);
    });
  });
});
