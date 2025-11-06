/**
 * Unit Tests for JWT Service
 * Tests JWT generation, verification, and security
 */

import { generateToken, verifyToken, extractTokenFromHeader } from '../../../services/jwtService';
import { generateExpiredToken } from '../../helpers/testHelpers';
import jwt from 'jsonwebtoken';

describe('JWTService', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token with email and emailHash', () => {
      const email = 'test@example.com';
      const token = generateToken(email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify token structure (3 parts separated by dots)
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should include email and emailHash in token payload', () => {
      const email = 'test@example.com';
      const token = generateToken(email);
      const decoded = verifyToken(token);

      expect(decoded.email).toBe(email);
      expect(decoded.emailHash).toBeTruthy();
      expect(typeof decoded.emailHash).toBe('string');
      expect(decoded.emailHash).toHaveLength(64); // SHA-256 hash is 64 chars
    });

    it('should include iat and exp timestamps', () => {
      const email = 'test@example.com';
      const token = generateToken(email);
      const decoded = verifyToken(token);

      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
      expect(decoded.exp).toBeGreaterThan(decoded.iat!);
    });

    it('should generate consistent emailHash for same email', () => {
      const email = 'test@example.com';
      const token1 = generateToken(email);
      const token2 = generateToken(email);

      const decoded1 = verifyToken(token1);
      const decoded2 = verifyToken(token2);

      expect(decoded1.emailHash).toBe(decoded2.emailHash);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const email = 'test@example.com';
      const token = generateToken(email);
      const decoded = verifyToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.email).toBe(email);
      expect(decoded.emailHash).toBeTruthy();
    });

    it('should throw error for expired token', () => {
      const expiredToken = generateExpiredToken();

      expect(() => verifyToken(expiredToken)).toThrow('Token expired');
    });

    it('should throw error for invalid signature', () => {
      const email = 'test@example.com';
      const token = generateToken(email);

      // Tamper with token by changing last character
      const tamperedToken = token.slice(0, -1) + 'X';

      expect(() => verifyToken(tamperedToken)).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not.a.valid.jwt.token';

      expect(() => verifyToken(malformedToken)).toThrow();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const header = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = extractTokenFromHeader(undefined);

      expect(extracted).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

      const extracted = extractTokenFromHeader(token);

      expect(extracted).toBeNull();
    });

    it('should return null for malformed Bearer header', () => {
      const extracted = extractTokenFromHeader('Bearer');

      expect(extracted).toBeNull();
    });

    it('should return null for header with multiple spaces', () => {
      const extracted = extractTokenFromHeader('Bearer  token  extra');

      expect(extracted).toBeNull();
    });
  });
});
