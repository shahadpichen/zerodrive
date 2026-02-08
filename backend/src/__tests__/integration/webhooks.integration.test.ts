/**
 * Integration Tests for Webhooks Routes
 * Tests Mailgun webhook endpoints for email delivery events
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import webhooksRouter from '../../routes/webhooks';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../services/emailService');

const mockVerifyWebhookSignature = jest.fn();

jest.mock('../../services/emailService', () => ({
  verifyWebhookSignature: (...args: any[]) => mockVerifyWebhookSignature(...args),
}));

describe('Webhooks Routes Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use('/api/webhooks', webhooksRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/webhooks/mailgun', () => {
    const validSignature = {
      timestamp: '1234567890',
      token: 'test-token',
      signature: 'valid-signature-hash',
    };

    const createMailgunEvent = (eventType: string, overrides = {}) => ({
      signature: validSignature,
      'event-data': {
        event: eventType,
        recipient: 'recipient@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          headers: {
            'message-id': '<test-message-id@mailgun.net>',
          },
        },
        ...overrides,
      },
    });

    describe('Authentication & Signature Validation', () => {
      it('should return 401 when webhook signature is invalid', async () => {
        mockVerifyWebhookSignature.mockReturnValue(false);

        const event = createMailgunEvent('delivered');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid signature');
        expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
          validSignature.timestamp,
          validSignature.token,
          validSignature.signature
        );
      });

      it('should process event when signature is valid', async () => {
        mockVerifyWebhookSignature.mockReturnValue(true);

        const event = createMailgunEvent('delivered');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Event processed');
      });

      it('should handle missing signature field', async () => {
        const event = {
          signature: {
            timestamp: '1234567890',
            token: 'test-token',
            // missing signature
          },
          'event-data': {
            event: 'delivered',
            recipient: 'test@example.com',
          },
        };

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        // Should still return 200 per error handling logic
        expect(response.status).toBe(200);
      });
    });

    describe('Event Type Handling', () => {
      beforeEach(() => {
        mockVerifyWebhookSignature.mockReturnValue(true);
      });

      it('should handle "delivered" event successfully', async () => {
        const event = createMailgunEvent('delivered');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Event processed');
      });

      it('should handle "failed" event with delivery status', async () => {
        const event = createMailgunEvent('failed', {
          reason: 'bounce',
          'delivery-status': {
            message: 'Mailbox does not exist',
            code: 550,
          },
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle "failed" event without delivery status', async () => {
        const event = createMailgunEvent('failed', {
          reason: 'generic',
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle "complained" event (spam)', async () => {
        const event = createMailgunEvent('complained');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle "unsubscribed" event', async () => {
        const event = createMailgunEvent('unsubscribed');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle "opened" event', async () => {
        const event = createMailgunEvent('opened');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle "clicked" event', async () => {
        const event = createMailgunEvent('clicked');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle unknown event type', async () => {
        const event = createMailgunEvent('unknown-event-type');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Event processed');
      });
    });

    describe('Edge Cases & Validation', () => {
      beforeEach(() => {
        mockVerifyWebhookSignature.mockReturnValue(true);
      });

      it('should handle missing event-data field', async () => {
        const event = {
          signature: validSignature,
        };

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        // Should return 200 even on error (per Mailgun best practices)
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(false);
      });

      it('should handle empty request body', async () => {
        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send({});

        expect(response.status).toBe(200);
      });

      it('should handle missing recipient field', async () => {
        const event = {
          signature: validSignature,
          'event-data': {
            event: 'delivered',
            timestamp: Math.floor(Date.now() / 1000),
          },
        };

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle missing message headers', async () => {
        const event = {
          signature: validSignature,
          'event-data': {
            event: 'delivered',
            recipient: 'test@example.com',
            timestamp: Math.floor(Date.now() / 1000),
            // no message field
          },
        };

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle event with tags', async () => {
        const event = createMailgunEvent('delivered', {
          tags: ['file-share-notification', 'production'],
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle special characters in recipient email', async () => {
        const event = createMailgunEvent('delivered', {
          recipient: 'test+special@example.com',
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle very old timestamp', async () => {
        const event = createMailgunEvent('delivered', {
          timestamp: 0,
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle future timestamp', async () => {
        const event = createMailgunEvent('delivered', {
          timestamp: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
        });

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        mockVerifyWebhookSignature.mockReturnValue(true);
      });

      it('should return 200 even when processing throws error', async () => {
        // Mock signature verification to throw error
        mockVerifyWebhookSignature.mockImplementation(() => {
          throw new Error('Verification failed');
        });

        const event = createMailgunEvent('delivered');

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        // Should still return 200 to prevent Mailgun retries
        expect(response.status).toBe(200);
      });

      it('should handle malformed JSON gracefully', async () => {
        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .set('Content-Type', 'application/json')
          .send('{"invalid json');

        // Express will handle malformed JSON before route handler
        expect(response.status).toBe(400);
      });

      it('should handle null event-data fields', async () => {
        const event = {
          signature: validSignature,
          'event-data': {
            event: null,
            recipient: null,
            timestamp: null,
          },
        };

        const response = await request(app)
          .post('/api/webhooks/mailgun')
          .send(event);

        expect(response.status).toBe(200);
      });
    });

    describe('Multiple Events Sequence', () => {
      beforeEach(() => {
        mockVerifyWebhookSignature.mockReturnValue(true);
      });

      it('should handle multiple events in sequence', async () => {
        const events = ['delivered', 'opened', 'clicked'];

        for (const eventType of events) {
          const event = createMailgunEvent(eventType);
          const response = await request(app)
            .post('/api/webhooks/mailgun')
            .send(event);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        }
      });

      it('should handle failed event after delivered event', async () => {
        // First: delivered
        const deliveredEvent = createMailgunEvent('delivered');
        await request(app)
          .post('/api/webhooks/mailgun')
          .send(deliveredEvent)
          .expect(200);

        // Then: failed (bounce)
        const failedEvent = createMailgunEvent('failed', {
          reason: 'bounce',
        });
        await request(app)
          .post('/api/webhooks/mailgun')
          .send(failedEvent)
          .expect(200);
      });
    });
  });

  describe('GET /api/webhooks/mailgun/health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/api/webhooks/mailgun/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook endpoint is configured and ready');
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should return valid ISO timestamp', async () => {
      const beforeRequest = new Date();
      const response = await request(app).get('/api/webhooks/mailgun/health');
      const afterRequest = new Date();

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should not require authentication', async () => {
      // No auth cookie provided
      const response = await request(app).get('/api/webhooks/mailgun/health');

      expect(response.status).toBe(200);
    });

    it('should handle multiple concurrent health checks', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/webhooks/mailgun/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
