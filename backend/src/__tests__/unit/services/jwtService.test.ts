/**
 * Unit Tests for JWT Service
 * Tests JWT generation, verification, and security
 */

import { generateToken, verifyToken, generateRefreshToken, verifyRefreshToken } from '../../../services/jwtService';
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

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token with email and emailHash', () => {
      const email = 'test@example.com';
      const token = generateRefreshToken(email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify token structure (3 parts separated by dots)
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should include email and emailHash in refresh token payload', () => {
      const email = 'test@example.com';
      const token = generateRefreshToken(email);
      const decoded = verifyRefreshToken(token);

      expect(decoded.email).toBe(email);
      expect(decoded.emailHash).toBeTruthy();
      expect(typeof decoded.emailHash).toBe('string');
      expect(decoded.emailHash).toHaveLength(64); // SHA-256 hash is 64 chars
    });

    it('should have longer expiry than access token', () => {
      const email = 'test@example.com';
      const accessToken = generateToken(email);
      const refreshToken = generateRefreshToken(email);

      const accessDecoded = verifyToken(accessToken);
      const refreshDecoded = verifyRefreshToken(refreshToken);

      // Refresh token should expire after access token
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp!);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and decode a valid refresh token', () => {
      const email = 'test@example.com';
      const token = generateRefreshToken(email);
      const decoded = verifyRefreshToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.email).toBe(email);
      expect(decoded.emailHash).toBeTruthy();
    });

    it('should throw error for expired refresh token', () => {
      // Create an expired refresh token
      const expiredToken = jwt.sign(
        { email: 'test@example.com', emailHash: 'hash' },
        process.env.JWT_SECRET || 'your-jwt-secret-here',
        { expiresIn: '-1s' }
      );

      expect(() => verifyRefreshToken(expiredToken)).toThrow('Refresh token expired');
    });

    it('should throw error for invalid refresh token signature', () => {
      const email = 'test@example.com';
      const token = generateRefreshToken(email);

      // Tamper with token
      const tamperedToken = token.slice(0, -1) + 'X';

      expect(() => verifyRefreshToken(tamperedToken)).toThrow('Invalid refresh token');
    });
  });
});
