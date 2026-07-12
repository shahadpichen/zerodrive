import { NextFunction, Request, Response } from "express";
import { isAnalyticsAdmin, isAnalyticsEnabled } from "../config/analytics";
import { ApiErrors } from "./errorHandler";

export function requireAnalyticsAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cache-Control", "no-store, private");

  if (!isAnalyticsEnabled()) {
    next(ApiErrors.ServiceUnavailable("Analytics is disabled"));
    return;
  }

  if (!isAnalyticsAdmin(req.user?.email)) {
    next(ApiErrors.Forbidden("Analytics administrator access required"));
    return;
  }

  next();
}
