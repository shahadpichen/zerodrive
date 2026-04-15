/**
 * Unit Tests for Auth Middleware
 * Tests JWT authentication middleware for protected routes
 */

import { requireAuth, optionalAuth } from '../../../middleware/auth';
import { mockRequest, mockResponse, mockNext, generateTestToken, generateExpiredToken } from '../../helpers/testHelpers';

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    it('should call next() for valid JWT token in cookie', () => {
      const token = generateTestToken('test@example.com');
      const req = mockRequest({
        cookies: { zerodrive_token: token },
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
        cookies: { zerodrive_token: token },
      });
      const res = mockResponse();
      const next = mockNext();

      requireAuth(req as any, res as any, next);

      expect(req.user).toBeDefined();
      expect(req.user?.email).toBe(email);
      expect(req.user?.emailHash).toBeTruthy();
      expect(typeof req.user?.emailHash).toBe('string');
    });

    it('should reject request without token cookie', () => {
      const req = mockRequest({
        cookies: {},
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
        cookies: { zerodrive_token: expiredToken },
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
        cookies: { zerodrive_token: tamperedToken },
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

    describe('CSRF validation', () => {
      it('should allow GET requests without CSRF token', () => {
        const token = generateTestToken('test@example.com');
        const req = mockRequest({
          method: 'GET',
          cookies: { zerodrive_token: token },
        });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should require CSRF token for POST requests', () => {
        const token = generateTestToken('test@example.com');
        const req = mockRequest({
          method: 'POST',
          cookies: { zerodrive_token: token },
          headers: {},
        });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            message: 'CSRF token required',
          })
        );
      });

      it('should reject POST request with missing CSRF cookie', () => {
        const token = generateTestToken('test@example.com');
        const req = mockRequest({
          method: 'POST',
          cookies: { zerodrive_token: token },
          headers: { 'x-csrf-token': 'abc123' },
        });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            message: 'CSRF token required',
          })
        );
      });

      it('should reject POST request with mismatched CSRF tokens', () => {
        const token = generateTestToken('test@example.com');
        const req = mockRequest({
          method: 'POST',
          cookies: {
            zerodrive_token: token,
            zerodrive_csrf: 'token123',
          },
          headers: { 'x-csrf-token': 'differentToken' },
        });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            message: 'CSRF validation failed',
          })
        );
      });

      it('should allow POST request with matching CSRF tokens', () => {
        const token = generateTestToken('test@example.com');
        const csrfToken = 'matching-csrf-token';
        const req = mockRequest({
          method: 'POST',
          cookies: {
            zerodrive_token: token,
            zerodrive_csrf: csrfToken,
          },
          headers: { 'x-csrf-token': csrfToken },
        });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req as any, res as any, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should require CSRF for PUT, DELETE, PATCH methods', () => {
        const token = generateTestToken('test@example.com');
        const methods = ['PUT', 'DELETE', 'PATCH'];

        methods.forEach((method) => {
          const req = mockRequest({
            method,
            cookies: { zerodrive_token: token },
            headers: {},
          });
          const res = mockResponse();
          const next = mockNext();

          requireAuth(req as any, res as any, next);

          expect(next).toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: 403,
            })
          );
        });
      });
    });
  });

  describe('optionalAuth', () => {
    it('should attach user object when valid token cookie provided', () => {
      const email = 'test@example.com';
      const token = generateTestToken(email);
      const req = mockRequest({
        cookies: { zerodrive_token: token },
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeDefined();
      expect(req.user?.email).toBe(email);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() without error when no token cookie provided', () => {
      const req = mockRequest({
        cookies: {},
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
        cookies: { zerodrive_token: 'invalid.token.here' },
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
        cookies: { zerodrive_token: expiredToken },
      });
      const res = mockResponse();
      const next = mockNext();

      optionalAuth(req as any, res as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });
});
