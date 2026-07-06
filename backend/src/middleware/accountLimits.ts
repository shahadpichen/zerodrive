import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

interface Counter {
  count: number;
  resetsAt: number;
}

const counters = new Map<string, Counter>();
const processPepper = crypto.randomBytes(32);

export interface AccountLimitOptions {
  name: string;
  max: number;
  windowMs: number;
}

function accountBucket(req: Request, name: string): string | null {
  if (!req.user?.emailHash) return null;
  return crypto
    .createHmac("sha256", processPepper)
    .update(`${name}:${req.user.emailHash}`)
    .digest("hex");
}

/**
 * Account-scoped abuse control whose identifiers and counters live only in
 * process memory. It never adds sender identity to share records or logs.
 */
export function accountLimit(options: AccountLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const bucket = accountBucket(req, options.name);
    if (!bucket) {
      next();
      return;
    }

    const now = Date.now();
    for (const [key, value] of counters) {
      if (value.resetsAt <= now) counters.delete(key);
    }
    const existing = counters.get(bucket);
    const counter =
      !existing || existing.resetsAt <= now
        ? { count: 0, resetsAt: now + options.windowMs }
        : existing;

    counter.count += 1;
    counters.set(bucket, counter);
    res.setHeader(
      "RateLimit-Remaining",
      Math.max(0, options.max - counter.count),
    );
    res.setHeader("RateLimit-Reset", Math.ceil(counter.resetsAt / 1000));

    if (counter.count > options.max) {
      res.status(429).json({
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        },
      });
      return;
    }
    next();
  };
}

export function clearAccountLimitsForTests(): void {
  counters.clear();
}
