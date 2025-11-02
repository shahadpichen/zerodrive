/**
 * Invitations Routes (TypeScript)
 *
 * Handles sending invitation emails to unregistered users
 */

import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiErrors } from '../middleware/errorHandler';
import { Request, Response } from 'express';
import { sendInvitationEmail } from '../services/emailService';
import { trackEvent, AnalyticsEvent, AnalyticsCategory } from '../services/analytics';

const router = Router();

// Rate limiting map: email -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit config
const MAX_INVITATIONS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check rate limit for an email address
 */
function checkRateLimit(email: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(email);

  // No previous record or window expired
  if (!record || now > record.resetTime) {
    rateLimitMap.set(email, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return {
      allowed: true,
      remaining: MAX_INVITATIONS_PER_HOUR - 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
  }

  // Within window - check if limit exceeded
  if (record.count >= MAX_INVITATIONS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: MAX_INVITATIONS_PER_HOUR - record.count,
    resetTime: record.resetTime
  };
}

// Validation schema
const sendInvitationSchema = Joi.object({
  recipient_email: Joi.string().email().required(),
  sender_message: Joi.string().max(500).optional()
});

/**
 * POST /api/invitations/send
 * Send invitation email to unregistered user
 */
router.post('/send', asyncHandler(async (
  req: Request,
  res: Response
) => {
  // Validate request body
  const { error, value } = sendInvitationSchema.validate(req.body);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { recipient_email, sender_message } = value;

  // Check rate limit
  const rateLimit = checkRateLimit(recipient_email);
  if (!rateLimit.allowed) {
    const resetDate = new Date(rateLimit.resetTime);
    throw ApiErrors.TooManyRequests(
      `Too many invitation requests for this email. Please try again after ${resetDate.toLocaleTimeString()}`
    );
  }

  try {
    // Send invitation email (non-blocking)
    await sendInvitationEmail(recipient_email, sender_message);

    // Track invitation sent (anonymous)
    trackEvent(AnalyticsEvent.INVITATION_SENT, AnalyticsCategory.SHARING, {
      has_custom_message: !!sender_message
    }).catch(() => {}); // Don't let analytics fail the request

    res.apiSuccess(
      {
        sent: true,
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
      },
      'Invitation sent successfully'
    );
  } catch (error) {
    throw ApiErrors.InternalServer('Failed to send invitation');
  }
}));

/**
 * GET /api/invitations/rate-limit/:email
 * Check rate limit status for an email
 */
router.get('/rate-limit/:email', asyncHandler(async (
  req: Request,
  res: Response
) => {
  const email = req.params.email;

  // Validate email format
  const { error } = Joi.string().email().validate(email);
  if (error) {
    throw ApiErrors.ValidationError('Invalid email format');
  }

  const now = Date.now();
  const record = rateLimitMap.get(email);

  if (!record || now > record.resetTime) {
    res.apiSuccess({
      remaining: MAX_INVITATIONS_PER_HOUR,
      resetTime: null,
      canSend: true
    });
  } else {
    res.apiSuccess({
      remaining: Math.max(0, MAX_INVITATIONS_PER_HOUR - record.count),
      resetTime: record.resetTime,
      canSend: record.count < MAX_INVITATIONS_PER_HOUR
    });
  }
}));

export default router;
