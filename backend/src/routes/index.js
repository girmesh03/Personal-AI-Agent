/**
 * @module routes/index
 * @description Central API v1 router consolidating and mounting all domain route modules.
 */

import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';

const router = express.Router();

// Mount authentication domain routes (/api/v1/auth)
router.use('/auth', authRoutes);

// Mount user domain routes (/api/v1/users)
router.use('/users', userRoutes);

export default router;
