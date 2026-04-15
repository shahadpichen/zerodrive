/**
 * Jest Test Setup
 * Runs before all tests to configure test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars';
process.env.JWT_EXPIRY = '1h';
process.env.EMAIL_HASH_SALT = 'test-salt';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/callback/google';
process.env.APP_URL = 'http://localhost:3000';

// Mock logger to prevent console noise during tests
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    query: jest.fn(),
    queryError: jest.fn(),
  },
}));

// Increase timeout for async operations
jest.setTimeout(10000);
