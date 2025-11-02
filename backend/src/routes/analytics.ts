/**
 * Analytics Routes
 *
 * API endpoints for viewing anonymous analytics data
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiErrors } from '../middleware/errorHandler';
import { Request, Response } from 'express';
import Joi from 'joi';
import {
  getAnalyticsSummary,
  getDailyStats,
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory
} from '../services/analytics';

const router = Router();

// Validation schema for tracking events
const trackEventSchema = Joi.object({
  event: Joi.string().required(),
  category: Joi.string().valid('auth', 'files', 'sharing').optional(),
  metadata: Joi.object().optional()
});

/**
 * GET /api/analytics/summary
 * Get analytics summary for a date range
 */
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const { days = 30 } = req.query;

  const daysNum = parseInt(days as string);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  const summary = await getAnalyticsSummary(startDate, endDate);

  res.apiSuccess(summary, `Analytics summary for last ${daysNum} days`);
}));

/**
 * GET /api/analytics/daily
 * Get daily statistics for charting
 */
router.get('/daily', asyncHandler(async (req: Request, res: Response) => {
  const { days = 30 } = req.query;

  const daysNum = parseInt(days as string);
  const stats = await getDailyStats(daysNum);

  res.apiSuccess(stats, `Daily stats for last ${daysNum} days`);
}));

/**
 * POST /api/analytics/track
 * Track an event from the frontend
 */
router.post('/track', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const { error, value } = trackEventSchema.validate(req.body);
  if (error) {
    throw ApiErrors.ValidationError(error.details[0].message);
  }

  const { event, category = AnalyticsCategory.AUTH, metadata } = value;

  // Track the event
  await trackEvent(event as AnalyticsEvent, category as AnalyticsCategory, metadata);

  res.apiSuccess({ tracked: true }, 'Event tracked successfully');
}));

export default router;
