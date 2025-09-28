/**
 * Express TypeScript Augmentations
 */

import { Request, Response } from 'express';
import { ApiResponse } from './index';

declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      requestId?: string;
    }

    interface Response {
      apiSuccess<T>(data?: T, message?: string, statusCode?: number): Response;
      apiError(error: string | Error, code?: string, statusCode?: number): Response;
    }
  }
}

// Typed Request handlers
export interface TypedRequest<
  P = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {}

export interface TypedResponse<T = any> extends Response {
  json(body: ApiResponse<T>): this;
}

// Async Route Handler Type
export type AsyncRouteHandler<
  P = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> = (
  req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
  res: TypedResponse<ResBody>,
  next: any
) => Promise<void> | void;

// Middleware Types
export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: any
) => void;

export type RequestMiddleware = (
  req: Request,
  res: Response,
  next: any
) => void | Promise<void>;