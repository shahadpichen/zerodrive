import { NextFunction, Request, Response } from "express";

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  return (
    address === "::1" ||
    address.startsWith("127.") ||
    address.startsWith("::ffff:127.")
  );
}

export function requiresHttps(
  nodeEnv: string,
  secure: boolean,
  remoteAddress: string | undefined,
): boolean {
  return (
    nodeEnv === "production" && !secure && !isLoopbackAddress(remoteAddress)
  );
}

export function enforceHttps(nodeEnv: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (requiresHttps(nodeEnv, req.secure, req.socket.remoteAddress)) {
      res.setHeader("Cache-Control", "no-store");
      res.status(426).json({
        success: false,
        error: {
          code: "HTTPS_REQUIRED",
          message: "HTTPS is required",
        },
      });
      return;
    }
    next();
  };
}
