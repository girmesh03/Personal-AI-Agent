/**
 * @module middleware/validate
 * @description Express middleware translating express-validator validation failures into domain ValidationError envelopes.
 */

import { validationResult, matchedData } from 'express-validator';
import { ValidationError } from '../errors/CustomError.js';

export { matchedData };

/**
 * Validates incoming request parameters against applied express-validator rules.
 * Supports direct middleware usage or options factory configuration.
 * Attaches sanitized, location-segregated matchedData to req.validated.
 *
 * @function validate
 * @param {Object|import('express').Request} [optionsOrReq={}] - MatchedData options or Express request object.
 * @param {import('express').Response} [resOrNext] - Express response object or next middleware.
 * @param {import('express').NextFunction} [maybeNext] - Express next middleware function.
 * @returns {import('express').RequestHandler|void}
 */
export const validate = (optionsOrReq = {}, resOrNext, maybeNext) => {
  // Direct middleware usage: validate(req, res, next)
  if (resOrNext && typeof maybeNext === 'function') {
    const req = optionsOrReq;
    const next = maybeNext;
    const result = validationResult(req);

    if (!result.isEmpty()) {
      const formattedErrors = result.array({ onlyFirstError: true }).map((err) => ({
        field: err.path || err.param || 'unknown',
        message: err.msg,
      }));

      return next(new ValidationError('Request validation failed', formattedErrors));
    }

    req.validated = {
      body: matchedData(req, { locations: ['body'] }),
      params: matchedData(req, { locations: ['params'] }),
      query: matchedData(req, { locations: ['query'] }),
    };
    req.matchedData = req.validated.body;

    return next();
  }

  // Middleware factory: validate(options)
  const options = optionsOrReq;
  return (req, _res, next) => {
    const result = validationResult(req);

    if (!result.isEmpty()) {
      const formattedErrors = result.array({ onlyFirstError: true }).map((err) => ({
        field: err.path || err.param || 'unknown',
        message: err.msg,
      }));

      return next(new ValidationError('Request validation failed', formattedErrors));
    }

    req.validated = {
      body: matchedData(req, { ...options, locations: ['body'] }),
      params: matchedData(req, { ...options, locations: ['params'] }),
      query: matchedData(req, { ...options, locations: ['query'] }),
    };
    req.matchedData = req.validated.body;

    next();
  };
};

export default validate;
