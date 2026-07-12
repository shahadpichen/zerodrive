/**
 * Analytics Routes
 *
 * API endpoints for viewing anonymous analytics data
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiErrors } from "../middleware/errorHandler";
import { Request, Response } from "express";
import Joi from "joi";
import {
  getAnalyticsSummary,
  getDailyStats,
  getDimensionStats,
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory,
} from "../services/analytics";
import { requireAnalyticsAdmin } from "../middleware/analyticsAdmin";
import { accountLimit } from "../middleware/accountLimits";
import { isAnalyticsEnabled } from "../config/analytics";

const router = Router();
const daysSchema = Joi.number().integer().min(1).max(365).default(30);
const frontendTrackableEvents = [AnalyticsEvent.FILE_ADDED_TO_DRIVE];

// Validation schema for tracking events
const trackEventSchema = Joi.object({
  event: Joi.string()
    .valid(...frontendTrackableEvents)
    .required(),
  category: Joi.string()
    .valid(AnalyticsCategory.FILES)
    .default(AnalyticsCategory.FILES),
  metadata: Joi.object({
    source: Joi.string().valid("upload", "download").optional(),
    size_bucket: Joi.string()
      .valid("<1MB", "1-10MB", "10-50MB", "50-100MB", ">100MB")
      .optional(),
    file_category: Joi.string()
      .valid(
        "image",
        "video",
        "audio",
        "text",
        "document",
        "archive",
        "other",
        "unknown",
      )
      .optional(),
  })
    .min(1)
    .optional(),
}).options({ allowUnknown: false });

function parseDays(value: unknown): number {
  const { error, value: days } = daysSchema.validate(value);
  if (error) {
    throw ApiErrors.ValidationError(
      "days must be an integer between 1 and 365",
    );
  }
  return days;
}

/**
 * GET /api/analytics/summary
 * Get analytics summary for a date range
 */
router.get(
  "/summary",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const daysNum = parseDays(req.query.days);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const summary = await getAnalyticsSummary(startDate, endDate);

    res.apiSuccess(summary, `Analytics summary for last ${daysNum} days`);
  }),
);

/**
 * GET /api/analytics/daily
 * Get daily statistics for charting
 */
router.get(
  "/daily",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const daysNum = parseDays(req.query.days);
    const stats = await getDailyStats(daysNum);

    res.apiSuccess(stats, `Daily stats for last ${daysNum} days`);
  }),
);

router.get(
  "/dimensions",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const daysNum = parseDays(req.query.days);
    const stats = await getDimensionStats(daysNum);
    res.apiSuccess(stats, `Analytics dimensions for last ${daysNum} days`);
  }),
);

/**
 * POST /api/analytics/track
 * Track an event from the frontend
 */
router.post(
  "/track",
  accountLimit({
    name: "analytics-track",
    max: process.env.NODE_ENV === "test" ? 1000 : 120,
    windowMs: 60 * 60 * 1000,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = trackEventSchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError(error.details[0].message);
    }

    const { event, category, metadata } = value;

    if (!isAnalyticsEnabled()) {
      res.apiSuccess({ tracked: false }, "Analytics are disabled");
      return;
    }

    // Track the event
    await trackEvent(
      event as AnalyticsEvent,
      category as AnalyticsCategory,
      metadata,
    );

    res.apiSuccess({ tracked: true }, "Event tracked successfully");
  }),
);

export default router;
