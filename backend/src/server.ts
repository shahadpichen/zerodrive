/**
 * ZeroDrive Backend Server (TypeScript)
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { testConnection } from './config/database';
import corsHandler from './middleware/cors';
import { errorHandler, notFoundHandler, responseHelpers } from './middleware/errorHandler';
import router from './routes';
import logger from './utils/logger';
import { cleanupExpiredShares } from './jobs/cleanupExpiredShares';

// Initialize Express app
const app: Application = express();

// Environment configuration
const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware with strict CSP
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://www.googleapis.com",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com"
      ],
      frameSrc: ["https://accounts.google.com"],
      objectSrc: ["'none'"],
      ...(NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// HTTPS enforcement middleware (production only)
if (NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && req.header('host')?.indexOf('localhost') === -1) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(corsHandler);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Request ID and timing middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = Math.random().toString(36).substring(2, 15);
  req.startTime = Date.now();
  next();
});

// Response helpers middleware
app.use(responseHelpers);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// API routes
app.use('/api', router);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.apiSuccess({
    name: 'ZeroDrive Backend API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  }, 'ZeroDrive Backend API is running');
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.shutdown(signal);
  
  const server = app.listen();
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Schedule cleanup job for expired shared files
    // Runs daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled cleanup job for expired shared files...');
      await cleanupExpiredShares();
    });

    logger.info('Scheduled cleanup job initialized (runs daily at 2:00 AM)');

    // Start HTTP server
    app.listen(PORT, HOST, () => {
      logger.startup({
        port: PORT,
        host: HOST,
        environment: NODE_ENV,
        pid: process.pid
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error as Error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;