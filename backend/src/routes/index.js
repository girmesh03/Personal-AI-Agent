/**
 * @module routes/index
 * @description Central API v1 router consolidating and mounting all domain route modules.
 */

import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import branchRoutes from './branchRoutes.js';
import reportRoutes from './reportRoutes.js';
import chatRoutes from './chatRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = express.Router();

// Mount authentication domain routes (/api/v1/auth)
router.use('/auth', authRoutes);

// Mount user domain routes (/api/v1/users)
router.use('/users', userRoutes);

// Mount branch domain routes (/api/v1/branches)
router.use('/branches', branchRoutes);

// Mount report domain routes (/api/v1/reports)
router.use('/reports', reportRoutes);

// Mount chat domain routes (/api/v1/chat)
router.use('/chat', chatRoutes);

// Mount dashboard analytics domain routes (/api/v1/dashboard)
router.use('/dashboard', dashboardRoutes);

export default router;
