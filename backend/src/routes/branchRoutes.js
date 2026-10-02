/**
 * @module routes/branchRoutes
 * @description Express router declaring physical operational branch management endpoints.
 * All routes are protected by verifyToken middleware and strictly scoped to req.user._id.
 */

import express from 'express';
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  archiveBranch,
  restoreBranch,
  deleteBranchPermanently,
} from '../controllers/branchController.js';
import {
  createBranchValidation,
  updateBranchValidation,
  branchIdParamValidation,
  listBranchesValidation,
} from '../validations/branchValidation.js';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all branch endpoints
router.use(verifyToken);

/**
 * @route POST /api/v1/branches
 * @desc Create a new physical operational branch
 * @access Protected (Area Supervisor)
 */
router.post('/', createBranchValidation, validate, createBranch);

/**
 * @route GET /api/v1/branches
 * @desc Retrieve paginated directory of branches with search and archive filter
 * @access Protected (Area Supervisor)
 */
router.get('/', listBranchesValidation, validate, getBranches);

/**
 * @route GET /api/v1/branches/:branchId
 * @desc Retrieve details of a single branch by ID
 * @access Protected (Area Supervisor)
 */
router.get('/:branchId', branchIdParamValidation, validate, getBranchById);

/**
 * @route PATCH /api/v1/branches/:branchId
 * @desc Update details of an active branch
 * @access Protected (Area Supervisor)
 */
router.patch('/:branchId', branchIdParamValidation, updateBranchValidation, validate, updateBranch);

/**
 * @route PATCH /api/v1/branches/:branchId/archive
 * @desc Archive an active branch location (auto-deleted after 30 days if unrestored)
 * @access Protected (Area Supervisor)
 */
router.patch('/:branchId/archive', branchIdParamValidation, validate, archiveBranch);
router.delete('/:branchId/archive', branchIdParamValidation, validate, archiveBranch);

/**
 * @route DELETE /api/v1/branches/:branchId/delete
 * @desc Permanently delete an archived branch without waiting for the 30-day auto-purge
 * @access Protected (Area Supervisor)
 */
router.delete('/:branchId/delete', branchIdParamValidation, validate, deleteBranchPermanently);
router.delete('/:branchId/permanent', branchIdParamValidation, validate, deleteBranchPermanently);

/**
 * @route PATCH /api/v1/branches/:branchId/restore
 * @desc Restore an archived branch before the 30-day auto-purge elapses
 * @access Protected (Area Supervisor)
 */
router.patch('/:branchId/restore', branchIdParamValidation, validate, restoreBranch);

/**
 * @route DELETE /api/v1/branches/:branchId
 * @desc Archive an active branch location (backward-compatible alias)
 * @access Protected (Area Supervisor)
 */
router.delete('/:branchId', branchIdParamValidation, validate, archiveBranch);

export default router;
