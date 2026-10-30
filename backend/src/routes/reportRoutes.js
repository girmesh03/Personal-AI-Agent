/**
 * @module routes/reportRoutes
 * @description Express routing definitions for corporate operational reports, audio ingestion,
 * paginated browsing, subdocument inspection, soft archival, restoration, and permanent deletion.
 * All routes are protected by verifyToken middleware and strictly scoped to req.user._id.
 */

import express from 'express';

import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  getReportActivities,
  getReportIssues,
  getReportComments,
  archiveReport,
  restoreReport,
  deleteReportPermanently,
  uploadReportAudios,
  shareReportToTelegram,
} from '../controllers/reportController.js';

import {
  reportIdValidation,
  getReportsValidation,
  updateReportValidation,
  createReportValidation,
} from '../validations/reportValidation.js';

import { uploadReportAudiosMiddleware } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validate.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication across all report endpoints
router.use(verifyToken);

/**
 * @route POST /api/v1/reports/upload-audio
 * @desc Ingest 1 to 5 audio recordings (max 25MB each, max 50MB batch)
 * @access Protected (Area Supervisor)
 */
router.post('/upload-audio', uploadReportAudiosMiddleware, uploadReportAudios);

/**
 * @route POST /api/v1/reports
 * @desc Create operational report (Agent Tool / Programmatic Pipeline)
 * @access Protected (Area Supervisor)
 */
router.post('/', createReportValidation, validate, createReport);

/**
 * @route GET /api/v1/reports
 * @desc Retrieve paginated list of reports (default active, ?archived=true for archive)
 * @access Protected (Area Supervisor)
 */
router.get('/', getReportsValidation, validate, getReports);

/**
 * @route GET /api/v1/reports/:reportId
 * @desc Retrieve details of a single report by ID
 * @access Protected (Area Supervisor)
 */
router.get('/:reportId', reportIdValidation, validate, getReportById);

/**
 * @route PATCH /api/v1/reports/:reportId
 * @desc Update operational report fields (manual UI edits or conversational instruction)
 * @access Protected (Area Supervisor)
 */
router.patch(
  '/:reportId',
  updateReportValidation,
  validate,
  updateReport
);

/**
 * @route GET /api/v1/reports/:reportId/activities
 * @desc Retrieve embedded activities subdocument array for report
 * @access Protected (Area Supervisor)
 */
router.get('/:reportId/activities', reportIdValidation, validate, getReportActivities);

/**
 * @route GET /api/v1/reports/:reportId/issues
 * @desc Retrieve embedded issues subdocument array for report
 * @access Protected (Area Supervisor)
 */
router.get('/:reportId/issues', reportIdValidation, validate, getReportIssues);

/**
 * @route GET /api/v1/reports/:reportId/comments
 * @desc Retrieve embedded comments subdocument array for report
 * @access Protected (Area Supervisor)
 */
router.get('/:reportId/comments', reportIdValidation, validate, getReportComments);

/**
 * @route PATCH /api/v1/reports/:reportId/archive
 * @desc Soft-archive an active report (initiates 30-day auto-purge retention window)
 * @access Protected (Area Supervisor)
 */
router.patch('/:reportId/archive', reportIdValidation, validate, archiveReport);
router.delete('/:reportId/archive', reportIdValidation, validate, archiveReport);

/**
 * @route PATCH /api/v1/reports/:reportId/restore
 * @desc Restore a soft-archived report before the 30-day auto-purge elapses
 * @access Protected (Area Supervisor)
 */
router.patch('/:reportId/restore', reportIdValidation, validate, restoreReport);

/**
 * @route DELETE /api/v1/reports/:reportId/delete
 * @desc Permanently cascade hard-delete report and associated audio binaries
 * @access Protected (Area Supervisor)
 */
router.delete('/:reportId/delete', reportIdValidation, validate, deleteReportPermanently);
router.delete('/:reportId/permanent', reportIdValidation, validate, deleteReportPermanently);

/**
 * @route POST /api/v1/reports/:reportId/share/telegram
 * @desc Broadcast operational report transcription to configured Telegram channel
 * @access Protected (Area Supervisor)
 */
router.post('/:reportId/share/telegram', reportIdValidation, validate, shareReportToTelegram);

/**
 * @route DELETE /api/v1/reports/:reportId
 * @desc Soft-archive an active report (backward-compatible alias)
 * @access Protected (Area Supervisor)
 */
router.delete('/:reportId', reportIdValidation, validate, archiveReport);

export default router;
