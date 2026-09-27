/**
 * @module app
 * @description Core Express 5 application setup, security middleware pipeline, and route mounting.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger, logStream } from './config/logger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// 1. Helmet security headers
app.use(helmet());

// 2. CORS configuration with credentials support
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Cookie parser for authentication tokens
app.use(cookieParser());

// 4. JSON body parser with 10MB payload limit
app.use(express.json({ limit: '10mb' }));

// 5. URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. HTTP request logger via Morgan
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logStream }));
}

// 7. System Health Check endpoints
app.get(['/api/health', '/api/v1/health'], (_req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: env.NODE_ENV,
  });
});

// 8. API v1 Router Mount (domain route modules attach here)
const apiV1Router = express.Router();
app.use('/api/v1', apiV1Router);

// 9. Unmatched Route Handler (404)
app.use(notFoundHandler);

// 10. Global Error Handler
app.use(errorHandler);

export default app;
