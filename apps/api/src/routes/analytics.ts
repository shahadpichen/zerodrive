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
  getMonthlyStats,
  getMonthlyDimensionStats,
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory,
} from "../services/analytics";
import { requireAnalyticsAdmin } from "../middleware/analyticsAdmin";
import { accountLimit } from "../middleware/accountLimits";
import { isAnalyticsEnabled } from "../config/analytics";

const router = Router();
const daysSchema = Joi.number().integer().min(1).max(400).default(30);
const monthsSchema = Joi.number().integer().min(1).max(240).default(120);
const isoDateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
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
      "days must be an integer between 1 and 400",
    );
  }
  return days;
}

function parseDateRange(query: Request["query"]): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const hasFrom = typeof query.from !== "undefined";
  const hasTo = typeof query.to !== "undefined";
  if (hasFrom !== hasTo) {
    throw ApiErrors.ValidationError("from and to must be provided together");
  }

  if (hasFrom && hasTo) {
    const fromResult = isoDateSchema.validate(query.from);
    const toResult = isoDateSchema.validate(query.to);
    if (fromResult.error || toResult.error) {
      throw ApiErrors.ValidationError("from and to must use YYYY-MM-DD");
    }

    const startDate = new Date(`${fromResult.value}T00:00:00.000Z`);
    const endDate = new Date(`${toResult.value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rangeDays =
      Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.toISOString().slice(0, 10) !== fromResult.value ||
      endDate.toISOString().slice(0, 10) !== toResult.value ||
      rangeDays < 1 ||
      rangeDays > 400 ||
      endDate > today
    ) {
      throw ApiErrors.ValidationError(
        "Choose a valid date range of up to 400 days ending today or earlier",
      );
    }
    return {
      startDate,
      endDate,
      label: `${fromResult.value} through ${toResult.value}`,
    };
  }

  const days = parseDays(query.days);
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  return { startDate, endDate, label: `last ${days} days` };
}

function parseMonths(value: unknown): number {
  const { error, value: months } = monthsSchema.validate(value);
  if (error) {
    throw ApiErrors.ValidationError(
      "months must be an integer between 1 and 240",
    );
  }
  return months;
}

/**
 * GET /api/analytics/summary
 * Get analytics summary for a date range
 */
router.get(
  "/summary",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, label } = parseDateRange(req.query);
    const summary = await getAnalyticsSummary(startDate, endDate);

    res.apiSuccess(summary, `Analytics summary for ${label}`);
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
    const { startDate, endDate, label } = parseDateRange(req.query);
    const stats = await getDailyStats(startDate, endDate);

    res.apiSuccess(stats, `Daily stats for ${label}`);
  }),
);

router.get(
  "/dimensions",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, label } = parseDateRange(req.query);
    const stats = await getDimensionStats(startDate, endDate);
    res.apiSuccess(stats, `Analytics dimensions for ${label}`);
  }),
);

router.get(
  "/monthly",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const months = parseMonths(req.query.months);
    const stats = await getMonthlyStats(months);
    res.apiSuccess(stats, `Monthly analytics history for ${months} months`);
  }),
);

router.get(
  "/monthly/dimensions",
  requireAnalyticsAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const months = parseMonths(req.query.months);
    const stats = await getMonthlyDimensionStats(months);
    res.apiSuccess(stats, `Monthly analytics dimensions for ${months} months`);
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
