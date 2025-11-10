/**
 * Unit Tests for Error Handler Middleware
 * Tests error handling, response formatting, and database error mapping
 */

import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  ApiErrors,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  responseHelpers,
} from '../../../middleware/errorHandler';
import { mockRequest, mockResponse, mockNext } from '../../helpers/testHelpers';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Error Handler Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ApiError', () => {
    it('should create ApiError with default values', () => {
      const error = new ApiError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create ApiError with custom values', () => {
      const error = new ApiError('Custom error', 404, 'NOT_FOUND');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should have stack trace', () => {
      const error = new ApiError('Test');
      expect(error.stack).toBeDefined();
    });
  });

  describe('ApiErrors factory functions', () => {
    it('should create BadRequest error (400)', () => {
      const error = ApiErrors.BadRequest('Bad request');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should create Unauthorized error (401)', () => {
      const error = ApiErrors.Unauthorized('Not authorized');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create Forbidden error (403)', () => {
      const error = ApiErrors.Forbidden();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create NotFound error (404)', () => {
      const error = ApiErrors.NotFound('Not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create Conflict error (409)', () => {
      const error = ApiErrors.Conflict('Already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create ValidationError (422)', () => {
      const error = ApiErrors.ValidationError('Invalid input');

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create TooManyRequests error (429)', () => {
      const error = ApiErrors.TooManyRequests('Rate limit exceeded');

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should create InternalServer error (500)', () => {
      const error = ApiErrors.InternalServer('Server error');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create ServiceUnavailable error (503)', () => {
      const error = ApiErrors.ServiceUnavailable('Down for maintenance');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle ApiError correctly', () => {
      const req = mockRequest({ url: '/api/test', method: 'GET' });
      const res = mockResponse();
      const next = mockNext();
      const error = ApiErrors.NotFound('Resource not found');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          stack: expect.any(String),
        },
      });
    });

    it('should not include stack in production', () => {
      process.env.NODE_ENV = 'production';

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = ApiErrors.InternalServer('Server error');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error',
        },
      });
    });

    it('should convert generic Error to ApiError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new Error('Generic error');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          stack: expect.any(String),
        },
      });
    });

    it('should handle PostgreSQL unique violation (23505)', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = Object.assign(new Error('Unique violation'), { code: '23505' });

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
          stack: expect.any(String),
        },
      });
    });

    it('should handle PostgreSQL foreign key violation (23503)', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = Object.assign(new Error('FK violation'), { code: '23503' });

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle JSON syntax errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new SyntaxError('Unexpected token in JSON');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid JSON in request body',
          stack: expect.any(String),
        },
      });
    });

    it('should handle Joi ValidationError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = {
        name: 'ValidationError',
        details: [{ message: 'Field required' }, { message: 'Invalid format' }],
        message: 'Validation failed',
      };

      errorHandler(error as any, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Field required, Invalid format',
          stack: expect.any(String),
        },
      });
    });
  });

  describe('notFoundHandler middleware', () => {
    it('should create 404 error for unmatched routes', () => {
      const req = mockRequest({ method: 'GET', url: '/api/unknown' });
      const res = mockResponse();
      const next = mockNext();

      notFoundHandler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Route GET /api/unknown not found',
        })
      );
    });
  });

  describe('asyncHandler wrapper', () => {
    it('should call next() with error when async function throws', async () => {
      const error = new Error('Async error');
      const asyncFn = async () => {
        throw error;
      };

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const wrapped = asyncHandler(asyncFn as any);
      await wrapped(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should not call next() when async function succeeds', async () => {
      const asyncFn = async () => {
        // Success
      };

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const wrapped = asyncHandler(asyncFn as any);
      await wrapped(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should handle promise rejections', async () => {
      const error = new Error('Promise rejected');
      const asyncFn = async (req: Request, res: Response, next: NextFunction) => {
        throw error;
      };

      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      const wrapped = asyncHandler(asyncFn);
      await wrapped(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('responseHelpers middleware', () => {
    it('should add apiSuccess method to response', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      expect(res.apiSuccess).toBeDefined();
      expect(typeof res.apiSuccess).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should add apiError method to response', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      expect(res.apiError).toBeDefined();
      expect(typeof res.apiError).toBe('function');
    });

    it('apiSuccess should format response correctly', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      res.apiSuccess!({ id: 123 }, 'Success message');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 123 },
        message: 'Success message',
      });
    });

    it('apiSuccess should work without data', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      res.apiSuccess!(undefined, 'No data');

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'No data',
      });
    });

    it('apiSuccess should accept custom status code', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      res.apiSuccess!({ id: 123 }, 'Created', 201);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('apiError should format error response correctly', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      res.apiError!('Error message', 'ERROR_CODE', 400);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ERROR_CODE',
          message: 'Error message',
        },
      });
    });

    it('apiError should accept Error object', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      responseHelpers(req as Request, res as Response, next);

      const error = new Error('Something went wrong');
      res.apiError!(error, 'ERROR_CODE', 500);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ERROR_CODE',
          message: 'Something went wrong',
        },
      });
    });
  });
});
