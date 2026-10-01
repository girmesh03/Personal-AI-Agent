/**
 * @module middleware/errorHandler
 * @description Centralized global error handling middleware normalizing all application exceptions.
 */

import { HTTP_STATUS } from '../utils/constants.js';
import {
  CustomError,
  ConflictError,
  ValidationError,
  BadRequestError,
  UnauthenticatedError,
} from '../errors/CustomError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Global Express 4-argument error-handling middleware.
 * Intercepts operational errors, Mongoose driver errors, and unhandled exceptions,
 * serializing them into a uniform JSON response envelope.
 *
 * @function errorHandler
 * @param {Error} err - Error object thrown or forwarded by route handlers.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} _next - Express next middleware function (required for 4-arg signature).
 * @returns {import('express').Response} Structured JSON error response.
 */
export const errorHandler = (err, req, res, _next) => {
  let error = err;

  // 1. Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    error = new ConflictError(`Duplicate value for '${field}': '${value}' already exists.`);
  }

  // 2. Mongoose validation error
  else if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = new ValidationError('Mongoose validation failed', details);
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId format)
  else if (err.name === 'CastError') {
    error = new BadRequestError(`Invalid format for '${err.path}': ${err.value}`);
  }

  // 4. JWT Authentication errors
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const message = err.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Please log in again.';
    error = new UnauthenticatedError(message, 'UNAUTHENTICATED');
  }

  // Handle known operational CustomError subclasses
  if (error instanceof CustomError) {
    // Log 4xx warnings, 5xx errors
    if (error.statusCode >= 500) {
      logger.error(`[${req.method}] ${req.originalUrl} - ${error.statusCode} ${error.errorCode}: ${error.message}\n${error.stack}`);
    } else {
      logger.warn(`[${req.method}] ${req.originalUrl} - ${error.statusCode} ${error.errorCode}: ${error.message}`);
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: null,
      errorCode: error.errorCode,
      details: error.details,
    });
  }

  // 5. Unhandled unexpected internal server errors (500)
  logger.error(`[UNHANDLED_EXCEPTION] [${req.method}] ${req.originalUrl} - ${err.message}\n${err.stack}`);

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Something went wrong on our end. Please try again later.' : err.message,
    data: null,
    errorCode: 'INTERNAL_SERVER_ERROR',
    details: null,
  });
};
