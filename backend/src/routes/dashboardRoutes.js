/**
 * @module routes/dashboardRoutes
 * @description Express router for executive operational dashboard metrics and analytics.
 * All routes are protected by verifyToken middleware and strictly scoped to req.user._id.
 */

import express from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all dashboard endpoints
router.use(verifyToken);

// GET /api/v1/dashboard/metrics
router.get('/metrics', getDashboardMetrics);

export default router;
