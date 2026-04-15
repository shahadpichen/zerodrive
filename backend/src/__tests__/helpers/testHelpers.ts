/**
 * Test Helper Utilities
 * Common utilities for backend tests
 */

import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../../services/jwtService';

/**
 * Create a mock Express Request object
 */
export const mockRequest = (overrides?: Partial<Request>): Partial<Request> => {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    get: jest.fn((header: string): string | string[] | undefined => {
      if (header === 'User-Agent') return 'Test User Agent';
      if (header === 'set-cookie') return undefined;
      return undefined;
    }) as any,
    ip: '127.0.0.1',
    ...overrides,
  };
};

/**
 * Create a mock Express Response object
 */
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    apiSuccess: jest.fn().mockReturnThis(),
    apiError: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Create a mock Express NextFunction
 */
export const mockNext = (): NextFunction => {
  return jest.fn();
};

/**
 * Create a test user object
 */
export const createTestUser = (overrides?: Partial<{ email: string; id: string }>) => {
  return {
    email: 'test@example.com',
    id: 'test-user-id',
    ...overrides,
  };
};

/**
 * Generate a test JWT token for a user
 */
export const generateTestToken = (email: string = 'test@example.com'): string => {
  return generateToken(email);
};

/**
 * Create mock database query result
 */
export const mockQueryResult = <T>(rows: T[], rowCount?: number) => {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
};

/**
 * Sleep utility for async tests
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Create expired JWT token (for testing token expiry)
 */
export const generateExpiredToken = (): string => {
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');

  const emailHash = crypto
    .createHash('sha256')
    .update('test@example.com' + process.env.EMAIL_HASH_SALT)
    .digest('hex');

  return jwt.sign(
    { email: 'test@example.com', emailHash },
    process.env.JWT_SECRET,
    { expiresIn: '-1h' } // Already expired
  );
};
