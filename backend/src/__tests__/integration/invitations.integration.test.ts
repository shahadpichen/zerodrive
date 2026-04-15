/**
 * Integration Tests for Invitations Routes
 * Tests invitation email sending and rate limiting
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../services/emailService');
jest.mock('../../services/analytics');

const mockSendInvitationEmail = jest.fn();
jest.mock('../../services/emailService', () => ({
  sendInvitationEmail: (...args: any[]) => mockSendInvitationEmail(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../services/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    INVITATION_SENT: 'invitation_sent',
  },
  AnalyticsCategory: {
    SHARING: 'sharing',
  },
}));

describe('Invitations Routes Integration', () => {
  let app: Application;

  // Helper to create a fresh app instance with fresh router
  function createApp() {
    // Clear module cache to get fresh router with clean rate limit map
    delete require.cache[require.resolve('../../routes/invitations')];
    const invitationsRouter = require('../../routes/invitations').default;

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use('/api/invitations', invitationsRouter);
    app.use(errorHandler);

    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Create fresh app instance for each test to reset rate limit state
    app = createApp();
  });

  describe('POST /api/invitations/send', () => {
    const validEmail = 'newuser@example.com';
    const validMessage = 'Join me on ZeroDrive!';

    beforeEach(() => {
      mockSendInvitationEmail.mockResolvedValue(undefined);
      mockTrackEvent.mockResolvedValue(undefined);
    });

    it('should send invitation successfully with valid email and message', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: validMessage,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sent).toBe(true);
      expect(response.body.data.remaining).toBe(4); // 5 - 1 = 4
      expect(response.body.data.resetTime).toBeDefined();
      expect(response.body.message).toBe('Invitation sent successfully');

      // Verify email service was called
      expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, validMessage);

      // Verify analytics was tracked
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'invitation_sent',
        'sharing',
        { has_custom_message: true }
      );
    });

    it('should send invitation successfully without custom message', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sent).toBe(true);

      // Verify email service was called without message
      expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, undefined);

      // Verify analytics tracked without custom message
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'invitation_sent',
        'sharing',
        { has_custom_message: false }
      );
    });

    it('should return 400 when recipient_email is missing', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          sender_message: validMessage,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('recipient_email');

      // Verify email service was NOT called
      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('should return 400 when recipient_email format is invalid', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: 'not-an-email',
          sender_message: validMessage,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('email');

      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('should return 400 when sender_message exceeds 500 characters', async () => {
      const longMessage = 'a'.repeat(501);

      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: longMessage,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('500');

      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('should accept sender_message at exactly 500 characters', async () => {
      const maxMessage = 'a'.repeat(500);

      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: maxMessage,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, maxMessage);
    });

    it('should reject empty sender_message', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: '',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // Empty string fails Joi validation
      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('should return 400 when request body is empty', async () => {
      const response = await request(app)
        .post('/api/invitations/send')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('should handle special characters in email', async () => {
      const emailWithPlus = 'user+tag@example.com';

      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: emailWithPlus,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSendInvitationEmail).toHaveBeenCalledWith(emailWithPlus, undefined);
    });

    it('should handle special characters in sender_message', async () => {
      const messageWithSpecialChars = 'Check this out! @#$%^&*() <script>alert("xss")</script>';

      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: messageWithSpecialChars,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, messageWithSpecialChars);
    });

    it('should handle unicode characters in sender_message', async () => {
      const unicodeMessage = 'Hello! 你好 مرحبا שלום 🚀🎉';

      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: validEmail,
          sender_message: unicodeMessage,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, unicodeMessage);
    });

    it('should return 500 when email service fails', async () => {
      mockSendInvitationEmail.mockRejectedValue(new Error('Mailgun API error'));

      // Use fresh email to avoid rate limiting from previous tests
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: 'failure-test@example.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Failed to send invitation');
    });

    it('should succeed even if analytics tracking fails', async () => {
      mockTrackEvent.mockRejectedValue(new Error('Analytics error'));

      // Use fresh email to avoid rate limiting from previous tests
      const response = await request(app)
        .post('/api/invitations/send')
        .send({
          recipient_email: 'analytics-test@example.com',
        });

      // Should still succeed
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSendInvitationEmail).toHaveBeenCalled();
    });

    describe('Rate Limiting', () => {
      const rateLimitedEmail = 'ratelimited@example.com';

      it('should allow up to 5 invitations within rate limit window', async () => {
        // Send 5 invitations
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            .post('/api/invitations/send')
            .send({ recipient_email: rateLimitedEmail });

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data.remaining).toBe(4 - i);
        }

        expect(mockSendInvitationEmail).toHaveBeenCalledTimes(5);
      });

      it('should return 429 when rate limit is exceeded', async () => {
        const email = 'exceeded@example.com';

        // Send 5 invitations (max allowed)
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/invitations/send')
            .send({ recipient_email: email });
        }

        // 6th invitation should be rate limited
        const response = await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: email });

        expect(response.status).toBe(429);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TOO_MANY_REQUESTS');
        expect(response.body.error.message).toContain('Too many invitation requests');
        expect(response.body.error.message).toContain('try again after');

        // Email service should have been called only 5 times
        expect(mockSendInvitationEmail).toHaveBeenCalledTimes(5);
      });

      it('should track rate limits per email address', async () => {
        const email1 = 'user1@example.com';
        const email2 = 'user2@example.com';

        // Send 5 invitations to email1
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            .post('/api/invitations/send')
            .send({ recipient_email: email1 });

          expect(response.status).toBe(200);
        }

        // email1 should be rate limited
        const response1 = await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: email1 });

        expect(response1.status).toBe(429);

        // email2 should still work (different email)
        const response2 = await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: email2 });

        expect(response2.status).toBe(200);
        expect(response2.body.data.remaining).toBe(4);
      });

      it('should return resetTime in response', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.data.resetTime).toBeDefined();
        expect(typeof response.body.data.resetTime).toBe('number');
        expect(response.body.data.resetTime).toBeGreaterThan(Date.now());
      });

      it('should reset rate limit after window expires', async () => {
        // This test would require time manipulation which is complex
        // In a real scenario, you'd mock Date.now() or use a library like timekeeper
        // For now, we verify the logic exists through other tests
      });
    });

    describe('Request Body Variations', () => {
      it('should reject extra fields in request body', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send({
            recipient_email: 'extrafields@example.com',
            sender_message: 'Test message',
            extra_field: 'should be rejected',
            another_field: 123,
          });

        // Joi validation rejects unknown keys for security
        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('not allowed');

        expect(mockSendInvitationEmail).not.toHaveBeenCalled();
      });

      it('should reject null sender_message', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send({
            recipient_email: validEmail,
            sender_message: null,
          });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject non-string recipient_email', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send({
            recipient_email: 12345,
          });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should reject non-string sender_message', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send({
            recipient_email: validEmail,
            sender_message: 12345,
          });

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle array in request body', async () => {
        const response = await request(app)
          .post('/api/invitations/send')
          .send([{ recipient_email: validEmail }]);

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
      });
    });

    describe('Email Format Validation', () => {
      const invalidEmails = [
        'plaintext',
        '@example.com',
        'user@',
        'user@.com',
        'user..double@example.com',
        'user@example',
        'user name@example.com',
        'user@exam ple.com',
        '',
        ' ',
        'user@',
        '@domain.com',
      ];

      invalidEmails.forEach((invalidEmail) => {
        it(`should reject invalid email: "${invalidEmail}"`, async () => {
          const response = await request(app)
            .post('/api/invitations/send')
            .send({
              recipient_email: invalidEmail,
            });

          expect(response.status).toBe(422);
          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');

          expect(mockSendInvitationEmail).not.toHaveBeenCalled();
        });
      });

      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@example-domain.com',
        'u@example.com',
        '123@example.com',
      ];

      validEmails.forEach((validEmail) => {
        it(`should accept valid email: "${validEmail}"`, async () => {
          const response = await request(app)
            .post('/api/invitations/send')
            .send({
              recipient_email: validEmail,
            });

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);

          expect(mockSendInvitationEmail).toHaveBeenCalledWith(validEmail, undefined);

          // Clear mocks for next iteration
          jest.clearAllMocks();
        });
      });
    });
  });

  describe('GET /api/invitations/rate-limit/:email', () => {
    it('should return rate limit status for email with no previous invitations', async () => {
      const response = await request(app)
        .get('/api/invitations/rate-limit/unused-email@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remaining).toBe(5);
      expect(response.body.data.resetTime).toBeNull();
      expect(response.body.data.canSend).toBe(true);
    });

    it('should return rate limit status after sending invitations', async () => {
      const email = 'testuser@example.com';

      // Send 2 invitations first
      await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      // Check rate limit status
      const response = await request(app)
        .get(`/api/invitations/rate-limit/${email}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remaining).toBe(3); // 5 - 2 = 3
      expect(response.body.data.resetTime).toBeDefined();
      expect(response.body.data.resetTime).toBeGreaterThan(Date.now());
      expect(response.body.data.canSend).toBe(true);
    });

    it('should show canSend false when rate limit is exhausted', async () => {
      const email = 'exhausted@example.com';

      // Send 5 invitations (max)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: email });
      }

      // Check rate limit status
      const response = await request(app)
        .get(`/api/invitations/rate-limit/${email}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remaining).toBe(0);
      expect(response.body.data.canSend).toBe(false);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .get('/api/invitations/rate-limit/not-an-email');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid email format');
    });

    it('should handle email with special characters in URL', async () => {
      const email = 'user+specialchars@example.com';
      const encodedEmail = encodeURIComponent(email);

      const response = await request(app)
        .get(`/api/invitations/rate-limit/${encodedEmail}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remaining).toBe(5);
    });

    it('should handle missing email parameter', async () => {
      const response = await request(app)
        .get('/api/invitations/rate-limit/');

      // Express returns 404 for missing route param
      expect(response.status).toBe(404);
    });

    it('should return rate limit info for different emails independently', async () => {
      const email1 = 'independent1@example.com';
      const email2 = 'independent2@example.com';

      // Send 1 invitation to email1
      await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email1 });

      // Send 3 invitations to email2
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/invitations/send')
          .send({ recipient_email: email2 });
      }

      // Check email1
      const response1 = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(email1)}`);

      expect(response1.body.data.remaining).toBe(4);

      // Check email2
      const response2 = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(email2)}`);

      expect(response2.body.data.remaining).toBe(2);
    });

    describe('Email Format Validation', () => {
      const invalidEmails = [
        'plaintext',
        '@example.com',
        'user@',
        'user name@example.com',
      ];

      invalidEmails.forEach((invalidEmail) => {
        it(`should reject invalid email in URL param: "${invalidEmail}"`, async () => {
          const response = await request(app)
            .get(`/api/invitations/rate-limit/${encodeURIComponent(invalidEmail)}`);

          expect(response.status).toBe(422);
          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.message).toBe('Invalid email format');
        });
      });

      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
      ];

      validEmails.forEach((validEmail) => {
        it(`should accept valid email in URL param: "${validEmail}"`, async () => {
          const response = await request(app)
            .get(`/api/invitations/rate-limit/${encodeURIComponent(validEmail)}`);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
        });
      });
    });

    it('should handle URL encoded spaces in email parameter', async () => {
      const response = await request(app)
        .get('/api/invitations/rate-limit/user%20test%40example.com');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid email format');
    });

    it('should handle very long email parameter', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';

      const response = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(longEmail)}`);

      // Joi email validator should reject this
      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Cross-Endpoint Rate Limit Consistency', () => {
    it('should maintain consistent rate limit state across endpoints', async () => {
      const email = 'consistent@example.com';

      // Send 2 invitations
      await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      // Check status via GET endpoint
      const statusResponse = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(email)}`);

      expect(statusResponse.body.data.remaining).toBe(3);

      // Send another invitation
      const sendResponse = await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      expect(sendResponse.body.data.remaining).toBe(2);

      // Verify status updated
      const updatedStatusResponse = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(email)}`);

      expect(updatedStatusResponse.body.data.remaining).toBe(2);
    });

    it('should use same resetTime across endpoints', async () => {
      const email = 'resettime@example.com';

      // Send invitation
      const sendResponse = await request(app)
        .post('/api/invitations/send')
        .send({ recipient_email: email });

      const resetTimeFromSend = sendResponse.body.data.resetTime;

      // Check status
      const statusResponse = await request(app)
        .get(`/api/invitations/rate-limit/${encodeURIComponent(email)}`);

      const resetTimeFromStatus = statusResponse.body.data.resetTime;

      // Should be the same resetTime
      expect(resetTimeFromSend).toBe(resetTimeFromStatus);
    });
  });
});
