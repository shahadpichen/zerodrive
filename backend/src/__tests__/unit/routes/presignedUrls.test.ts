/**
 * Unit Tests for Presigned URL Routes
 * Tests S3 presigned URL generation for upload and download
 */

import request from 'supertest';
import express, { Application } from 'express';
import presignedUrlsRouter from '../../../routes/presignedUrls';

// Mock S3 client
jest.mock('../../../config/s3');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

describe('Presigned URL Routes', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/presigned-url', presignedUrlsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue('https://minio.example.com/presigned-url?signature=xyz');
  });

  describe('POST /api/presigned-url/upload', () => {
    it('should generate upload URL successfully', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({
          fileName: 'test.txt',
          fileSize: 1024,
          mimeType: 'text/plain',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.uploadUrl).toBeDefined();
      expect(response.body.data.fileKey).toBeDefined();
      expect(response.body.data.expiresIn).toBe(300); // 5 minutes
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should generate unique file keys for same filename', async () => {
      const response1 = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      const response2 = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      expect(response1.body.data.fileKey).not.toBe(response2.body.data.fileKey);
    });

    it('should include timestamp and randomId in fileKey', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      const fileKey = response.body.data.fileKey;
      expect(fileKey).toContain('shared/');
      expect(fileKey).toContain('test.txt');
      expect(fileKey).toMatch(/shared\/\d+-\w+-test\.txt/);
    });

    it('should return 400 when fileName is missing', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when fileName is too long', async () => {
      const longFileName = 'a'.repeat(256) + '.txt';

      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: longFileName });

      expect(response.status).toBe(400);
    });

    it('should accept request without optional fields', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      expect(response.status).toBe(200);
      expect(response.body.data.uploadUrl).toBeDefined();
    });

    it('should use provided mimeType', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
        });

      expect(response.status).toBe(200);
      expect(mockGetSignedUrl).toHaveBeenCalled();

      // Verify PutObjectCommand was created with correct mimeType
      const commandArg = mockGetSignedUrl.mock.calls[0][1];
      expect(commandArg.input.ContentType).toBe('application/pdf');
    });

    it('should default to octet-stream when mimeType not provided', async () => {
      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.bin' });

      expect(response.status).toBe(200);

      const commandArg = mockGetSignedUrl.mock.calls[0][1];
      expect(commandArg.input.ContentType).toBe('application/octet-stream');
    });

    it('should return 500 when S3 signing fails', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('S3 connection error'));

      const response = await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('SERVER_ERROR');
    });
  });

  describe('POST /api/presigned-url/download', () => {
    it('should generate download URL successfully', async () => {
      const fileKey = 'shared/123-abc-test.txt';

      const response = await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.downloadUrl).toBeDefined();
      expect(response.body.data.fileKey).toBe(fileKey);
      expect(response.body.data.expiresIn).toBe(300);
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should return 400 when fileKey is missing', async () => {
      const response = await request(app)
        .post('/api/presigned-url/download')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when fileKey is too long', async () => {
      const longFileKey = 'a'.repeat(513);

      const response = await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey: longFileKey });

      expect(response.status).toBe(400);
    });

    it('should handle fileKey with special characters', async () => {
      const fileKey = 'shared/2024-01-01-file%20name.txt';

      const response = await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey });

      expect(response.status).toBe(200);
    });

    it('should return 500 when S3 signing fails', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('S3 error'));

      const response = await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey: 'test-key' });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('SERVER_ERROR');
    });

    it('should use GetObjectCommand for downloads', async () => {
      await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey: 'shared/test.txt' });

      const commandArg = mockGetSignedUrl.mock.calls[0][1];
      expect(commandArg.constructor.name).toBe('GetObjectCommand');
    });
  });

  describe('URL expiration', () => {
    it('should set 5 minute expiration for upload URLs', async () => {
      await request(app)
        .post('/api/presigned-url/upload')
        .send({ fileName: 'test.txt' });

      const options = mockGetSignedUrl.mock.calls[0][2];
      expect(options.expiresIn).toBe(300);
    });

    it('should set 5 minute expiration for download URLs', async () => {
      await request(app)
        .post('/api/presigned-url/download')
        .send({ fileKey: 'test-key' });

      const options = mockGetSignedUrl.mock.calls[0][2];
      expect(options.expiresIn).toBe(300);
    });
  });
});
