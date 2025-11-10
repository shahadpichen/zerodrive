/**
 * Unit Tests for Crypto Routes
 * Tests server-side email hashing endpoint
 */

import request from 'supertest';
import express, { Application } from 'express';
import cryptoRouter from '../../../routes/crypto';

describe('Crypto Routes', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/crypto', cryptoRouter);
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.EMAIL_HASH_SALT = 'test-salt-value';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST /api/crypto/hash-email', () => {
    it('should hash email successfully with valid email', async () => {
      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hashedEmail).toBeDefined();
      expect(typeof response.body.data.hashedEmail).toBe('string');
      expect(response.body.data.hashedEmail).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should produce consistent hashes for same email', async () => {
      const email = 'test@example.com';

      const response1 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email });

      const response2 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email });

      expect(response1.body.data.hashedEmail).toBe(
        response2.body.data.hashedEmail
      );
    });

    it('should produce different hashes for different emails', async () => {
      const response1 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test1@example.com' });

      const response2 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test2@example.com' });

      expect(response1.body.data.hashedEmail).not.toBe(
        response2.body.data.hashedEmail
      );
    });

    it('should normalize email before hashing', async () => {
      // Test case sensitivity
      const response1 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'Test@Example.com' });

      const response2 = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test@example.com' });

      expect(response1.body.data.hashedEmail).toBe(
        response2.body.data.hashedEmail
      );
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('email');
    });

    it('should return 500 when EMAIL_HASH_SALT is not configured', async () => {
      delete process.env.EMAIL_HASH_SALT;

      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('CONFIGURATION_ERROR');
    });

    it('should handle special characters in email', async () => {
      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: 'test+tag@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.data.hashedEmail).toBeDefined();
    });

    it('should reject email with leading/trailing whitespace', async () => {
      const response = await request(app)
        .post('/api/crypto/hash-email')
        .send({ email: '  test@example.com  ' });

      // Email validator rejects emails with leading/trailing whitespace
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
