/**
 * Unit Tests for Auth Middleware
 * Tests JWT authentication middleware for protected routes
 */

import { requireAuth, optionalAuth } from '../../../middleware/auth';
import { mockRequest, mockResponse, mockNext, generateTestToken, generateExpiredToken } from '../../helpers/testHelpers';

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    it('should call next() for valid JWT token', () => {
      const token = generateTestToken('test@example.com');
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should attach user object to request', () => {
      const email = 'test@example.com';
      const token = generateTestToken(email);
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(req.user).toBeDefined();
      expect(req.user?.email).toBe(email);
      expect(req.user?.emailHash).toBeTruthy();
      expect(typeof req.user?.emailHash).toBe('string');
    });

    it('should reject request without Authorization header', () => {
      const req = mockRequest({
        headers: {},
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
      // Verify it's called with an error
      const callArg = (next as jest.Mock).mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Error);
    });

    it('should reject request with expired JWT', () => {
      const expiredToken = generateExpiredToken();
      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Token expired',
        })
      );
    });

    it('should reject request with invalid JWT signature', () => {
      const token = generateTestToken('test@example.com');
      const tamperedToken = token.slice(0, -5) + 'XXXXX';

      const req = mockRequest({
        headers: { authorization: `Bearer ${tamperedToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid token',
        })
      );
    });

    it('should reject request with malformed Bearer header', () => {
      const req = mockRequest({
        headers: { authorization: 'InvalidFormat token' },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  describe('optionalAuth', () => {
    it('should attach user object when valid token provided', () => {
      const email = 'test@example.com';
      const token = generateTestToken(email);
      const req = mockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeDefined();
      expect(req.user?.email).toBe(email);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() without error when no token provided', () => {
      const req = mockRequest({
        headers: {},
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next() without error when token is invalid', () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid.token.here' },
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() without error when token is expired', () => {
      const expiredToken = generateExpiredToken();
      const req = mockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });
});
