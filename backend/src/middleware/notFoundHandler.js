/**
 * @module middleware/notFoundHandler
 * @description Catches all unmatched routes and forwards a NotFoundError to the error pipeline.
 */

import { NotFoundError } from '../errors/CustomError.js';

/**
 * 404 Not Found catch-all middleware.
 * @function notFoundHandler
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} _res - Express response object (unused).
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 */
export const notFoundHandler = (req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
};
