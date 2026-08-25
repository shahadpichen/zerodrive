import { Router, type Request, type Response } from "express";
import {
  ANALYTICS_PAGE_KEYS,
  type AnalyticsPageKey,
} from "@zerodrive/shared-types";
import Joi from "joi";
import { asyncHandler, ApiErrors } from "../middleware/errorHandler";
import { isAnalyticsEnabled } from "../config/analytics";
import {
  AnalyticsCategory,
  AnalyticsEvent,
  trackEvent,
} from "../services/analytics";

const router = Router();

const pageViewSchema = Joi.object({
  page: Joi.string()
    .valid(...ANALYTICS_PAGE_KEYS)
    .required(),
}).options({ allowUnknown: false });

/**
 * Public because landing pages and documentation do not require an account.
 * The body accepts one reviewed product-page key only: never a URL, raw path,
 * referrer, query string, session, or visitor identifier.
 */
router.post(
  "/page-view",
  asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = pageViewSchema.validate(req.body);
    if (error) {
      throw ApiErrors.ValidationError("Unknown analytics page");
    }

    if (!isAnalyticsEnabled()) {
      res.apiSuccess({ tracked: false }, "Analytics are disabled");
      return;
    }

    await trackEvent(AnalyticsEvent.PAGE_VIEW, AnalyticsCategory.NAVIGATION, {
      page: value.page as AnalyticsPageKey,
    });
    res.apiSuccess({ tracked: true }, "Page view counted");
  }),
);

export default router;
