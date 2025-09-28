/**
 * TypeScript Logger Utility
 */

import { LogLevel, LogMeta, RequestLogMeta } from '../types';
import { Request, Response } from 'express';

// Environment configuration
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Log levels hierarchy
const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Console colors for development
const colors: Record<LogLevel | 'reset', string> = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m',  // Yellow
  info: '\x1b[36m',  // Cyan
  debug: '\x1b[90m', // Gray
  reset: '\x1b[0m'   // Reset
};

/**
 * Get current timestamp in ISO format
 */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Format log message for output
 */
const formatMessage = (level: LogLevel, message: string, meta: LogMeta = {}): string => {
  const timestamp = getTimestamp();
  const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  
  if (nodeEnv === 'development') {
    // Colorized output for development
    return `${colors[level]}[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}${colors.reset}`;
  } else {
    // Structured JSON output for production
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    });
  }
};

/**
 * Check if a log level should be output
 */
const shouldLog = (level: LogLevel): boolean => {
  return levels[level] <= levels[logLevel];
};

/**
 * Format error object for logging
 */
const formatError = (error: Error): LogMeta => {
  return {
    name: error.name,
    message: error.message,
    stack: nodeEnv === 'development' ? error.stack : undefined
  };
};

/**
 * Main Logger class
 */
class Logger {
  /**
   * Log error messages
   */
  error(message: string, meta: LogMeta | Error = {}): void {
    if (shouldLog('error')) {
      const errorMeta = meta instanceof Error ? formatError(meta) : meta;
      console.error(formatMessage('error', message, errorMeta));
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, meta: LogMeta = {}): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  }

  /**
   * Log info messages
   */
  info(message: string, meta: LogMeta = {}): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  }

  /**
   * Log debug messages
   */
  debug(message: string, meta: LogMeta = {}): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  }

  /**
   * Log HTTP requests
   */
  request(req: Request, res: Response, duration: number): void {
    const userAgent = req.get('User-Agent');
    const meta: RequestLogMeta = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ...(userAgent && { userAgent }),
      ip: req.ip || req.connection.remoteAddress || 'unknown'
    };
    
    const message = `${req.method} ${req.url}`;
    
    if (res.statusCode >= 400) {
      this.warn(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  /**
   * Log database queries (for debugging)
   */
  query(queryText: string, duration: number, rowCount: number): void {
    if (shouldLog('debug')) {
      const truncatedQuery = queryText.length > 100 
        ? queryText.substring(0, 100) + '...' 
        : queryText;
      
      this.debug('Database query executed', {
        query: truncatedQuery,
        duration: `${duration}ms`,
        rows: rowCount
      });
    }
  }

  /**
   * Log database query errors
   */
  queryError(queryText: string, duration: number, error: Error): void {
    const truncatedQuery = queryText.length > 100 
      ? queryText.substring(0, 100) + '...' 
      : queryText;
    
    this.error('Database query failed', {
      query: truncatedQuery,
      duration: `${duration}ms`,
      error: formatError(error)
    });
  }

  /**
   * Log application startup
   */
  startup(config: { port: number; host: string; environment: string; pid: number }): void {
    this.info('ZeroDrive Backend API started', config);
  }

  /**
   * Log application shutdown
   */
  shutdown(signal: string): void {
    this.info(`Received ${signal}. Starting graceful shutdown...`);
  }
}

// Create and export logger instance
const logger = new Logger();

export default logger;
export { Logger };