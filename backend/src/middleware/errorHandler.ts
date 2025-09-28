/**
 * Error Handler Middleware (TypeScript)
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'joi';
import logger from '../utils/logger';
import { ApiResponse, ApiErrorDetails } from '../types';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common API error factory functions
 */
export const ApiErrors = {
  BadRequest: (message: string = 'Bad Request'): ApiError => 
    new ApiError(message, 400, 'BAD_REQUEST'),
  
  Unauthorized: (message: string = 'Unauthorized'): ApiError => 
    new ApiError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message: string = 'Forbidden'): ApiError => 
    new ApiError(message, 403, 'FORBIDDEN'),
  
  NotFound: (message: string = 'Not Found'): ApiError => 
    new ApiError(message, 404, 'NOT_FOUND'),
  
  Conflict: (message: string = 'Conflict'): ApiError => 
    new ApiError(message, 409, 'CONFLICT'),
  
  ValidationError: (message: string = 'Validation Error'): ApiError => 
    new ApiError(message, 422, 'VALIDATION_ERROR'),
  
  TooManyRequests: (message: string = 'Too Many Requests'): ApiError => 
    new ApiError(message, 429, 'TOO_MANY_REQUESTS'),
  
  InternalServer: (message: string = 'Internal Server Error'): ApiError => 
    new ApiError(message, 500, 'INTERNAL_ERROR'),
  
  ServiceUnavailable: (message: string = 'Service Unavailable'): ApiError => 
    new ApiError(message, 503, 'SERVICE_UNAVAILABLE')
};

/**
 * Handle PostgreSQL database errors
 */
const handleDatabaseError = (error: any): ApiError => {
  logger.error('Database error', error);
  
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique violation
      return ApiErrors.Conflict('Resource already exists');
    case '23503': // Foreign key violation
      return ApiErrors.BadRequest('Referenced resource does not exist');
    case '23502': // Not null violation
      return ApiErrors.BadRequest('Required field is missing');
    case '22001': // String data too long
      return ApiErrors.BadRequest('Data too long for field');
    case '08001': // Connection error
      return ApiErrors.ServiceUnavailable('Database connection error');
    case '08006': // Connection failure
      return ApiErrors.ServiceUnavailable('Database connection failed');
    case '42703': // Undefined column
      return ApiErrors.BadRequest('Invalid field specified');
    case '42P01': // Undefined table
      return ApiErrors.InternalServer('Database schema error');
    default:
      return ApiErrors.InternalServer('Database operation failed');
  }
};

/**
 * Handle Joi validation errors
 */
const handleValidationError = (error: ValidationError): ApiError => {
  const message = error.details?.map(detail => detail.message).join(', ') || 'Validation failed';
  return ApiErrors.ValidationError(message);
};

/**
 * Main error handler middleware
 */
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let apiError: ApiError;
  
  // Convert non-API errors to API errors
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error.name === 'ValidationError') {
    // Joi validation error
    apiError = handleValidationError(error as ValidationError);
  } else if ('code' in error && typeof error.code === 'string' && error.code.length === 5) {
    // PostgreSQL error codes are 5 characters
    apiError = handleDatabaseError(error);
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    apiError = ApiErrors.BadRequest('Invalid JSON in request body');
  } else if (error.name === 'CastError') {
    apiError = ApiErrors.BadRequest('Invalid ID format');
  } else {
    // Generic server error
    apiError = ApiErrors.InternalServer('An unexpected error occurred');
  }
  
  // Log error details
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: apiError.statusCode,
    code: apiError.code,
    message: apiError.message,
    stack: process.env.NODE_ENV === 'development' ? apiError.stack : undefined,
    body: req.body,
    query: req.query,
    params: req.params,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };
  
  if (apiError.statusCode >= 500) {
    logger.error('Server error', logData);
  } else {
    logger.warn('Client error', logData);
  }
  
  // Send error response
  const response: ApiResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(process.env.NODE_ENV === 'development' && { stack: apiError.stack })
    }
  };
  
  res.status(apiError.statusCode).json(response);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = ApiErrors.NotFound(`Route ${req.method} ${req.url} not found`);
  next(error);
};

/**
 * Async error wrapper to catch promise rejections
 */
export const asyncHandler = <T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
) => {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Response helper middleware to add success/error methods
 */
export const responseHelpers = (req: Request, res: Response, next: NextFunction): void => {
  // Add success response helper
  res.apiSuccess = function<T>(data?: T, message?: string, statusCode: number = 200): Response {
    const response: ApiResponse<T> = {
      success: true,
      ...(data !== undefined && { data }),
      ...(message && { message })
    };
    
    return this.status(statusCode).json(response);
  };

  // Add error response helper
  res.apiError = function(error: string | Error, code: string = 'ERROR', statusCode: number = 500): Response {
    const message = typeof error === 'string' ? error : error.message;
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message
      }
    };
    
    return this.status(statusCode).json(response);
  };

  next();
};