/**
 * @module controllers/reportController
 * @description Controller managing Corporate Operational Reports: programmatic creation via AI agent,
 * paginated listing, single report inspection, subdocument queries (activities, issues, comments),
 * manual UI updates, soft archival, restoration, cascade permanent deletion, and audio ingestion.
 * All write operations strictly execute within Mongoose transaction sessions for ACID integrity.
 */

import fs from 'node:fs';
import path from 'node:path';

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';

import { Report } from '../models/Report.js';
import { Branch } from '../models/Branch.js';
import { Audio } from '../models/Audio.js';
import { HTTP_STATUS, REPORT_CONSTANTS, AUDIO_CONSTANTS } from '../utils/constants.js';
import { NotFoundError, BadRequestError } from '../errors/CustomError.js';
import { logger } from '../config/logger.js';


/**
 * Persists an operational report document into MongoDB inside an ACID transaction session.
 * Pure service function: completely decoupled from Express req/res.
 * Directly invoked by the in-process AI Agent Tool execution pipeline (Task 7.5) and the HTTP controller.
 *
 * @function createReportRecord
 * @param {Object} params - Creation parameters.
 * @param {string|import('mongoose').Types.ObjectId} params.userId - Authenticated supervisor user ID.
 * @param {Object} params.payload - Validated operational report payload.
 * @param {import('mongoose').ClientSession} [params.existingSession=null] - Optional outer Mongoose transaction session.
 * @returns {Promise<import('../models/Report.js').ReportDocument>} The persisted Report document.
 */
export const createReportRecord = async ({ userId, payload, existingSession = null }) => {
  const { date, clockIn, clockOut, visits, activities, issues, comments, transcription, audios } =
    payload;

  const session = existingSession || (await mongoose.startSession());
  const ownsSession = !existingSession;

  try {
    let createdReport;

    const executeWork = async (sess) => {
      // 1. Verify that all referenced branches exist, belong to this supervisor, and are active
      const referencedBranchIds = visits.map((v) => String(v.branch));
      const uniqueBranchIds = [...new Set(referencedBranchIds)];

      const foundBranches = await Branch.find({
        _id: { $in: uniqueBranchIds },
        user: userId,
      })
        .session(sess)
        .lean();

      if (foundBranches.length !== uniqueBranchIds.length) {
        throw new NotFoundError(
          'One or more referenced branches could not be found or do not belong to your account.'
        );
      }

      // 2. Verify standalone audio records if provided
      if (audios && audios.length > 0) {
        const foundAudios = await Audio.find({
          _id: { $in: audios },
          user: userId,
          isArchived: false,
        })
          .session(sess)
          .lean();

        if (foundAudios.length !== audios.length) {
          throw new NotFoundError(
            'One or more referenced audio recordings could not be found or have been archived.'
          );
        }
      }

      // 3. Atomically persist the report document
      const [report] = await Report.create(
        [
          {
            user: userId,
            date: new Date(date),
            clockIn,
            clockOut,
            visits,
            activities: activities || [],
            issues: issues || [],
            comments: comments || [],
            transcription,
            audios: audios || [],
            isArchived: false,
            archivedAt: null,
          },
        ],
        { session: sess }
      );

      createdReport = report;
    };

    if (ownsSession) {
      await session.withTransaction(async () => {
        await executeWork(session);
      });
    } else {
      await executeWork(session);
    }

    return createdReport;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
};

/**
 * Creates a new corporate operational report for the authenticated supervisor.
 * HTTP adapter wrapping the pure createReportRecord persistence engine.
 *
 * @function createReport
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const createReport = asyncHandler(async (req, res) => {
  const validatedPayload = req.validated?.body || req.body || {};
  const report = await createReportRecord({
    userId: req.user._id,
    payload: validatedPayload,
  });

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'Report created successfully',
    data: {
      report,
    },
  });
});

/**
 * Retrieves a paginated list of operational reports for the authenticated supervisor.
 * Default query strictly excludes soft-archived reports; ?archived=true lists archived reports.
 * Supports filtering by branch and date.
 *
 * @function getReports
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getReports = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query || {};
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || REPORT_CONSTANTS.PAGE_LIMIT_DEFAULT;

  const isArchivedRequested = query.archived === 'true' || query.archived === true;

  const filter = {
    user: req.user._id,
    isArchived: isArchivedRequested,
  };

  // Branch visit filter
  if (query.branch) {
    filter['visits.branch'] = query.branch;
  }

  // Date filter (matches full UTC day)
  if (query.date) {
    const targetDate = new Date(query.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    filter.date = { $gte: startOfDay, $lte: endOfDay };
  }

  const options = {
    page,
    limit,
    sort: isArchivedRequested ? { archivedAt: -1, createdAt: -1 } : { date: -1, createdAt: -1 },
    populate: [
      { path: 'visits.branch', select: 'name code location managerName' },
      {
        path: 'audios',
        select: 'fileName originalName mimeType size path duration url transcription status',
      },
      { path: 'user', select: 'fullName email position avatar' },
    ],
  };

  const result = await Report.paginate(filter, options);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Reports retrieved successfully',
    data: {
      docs: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
  });
});

/**
 * Retrieves details of a single operational report by its identifier.
 * Scoped strictly to the authenticated supervisor.
 *
 * @function getReportById
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const report = await Report.findOne({
    _id: reportId,
    user: req.user._id,
  }).populate([
    { path: 'visits.branch', select: 'name code location managerName' },
    {
      path: 'audios',
      select: 'fileName originalName mimeType size path duration url transcription status',
    },
    { path: 'user', select: 'fullName email position avatar' },
  ]);

  if (!report) {
    throw new NotFoundError('Report not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Report retrieved successfully',
    data: {
      report,
    },
  });
});

/**
 * Updates operational report fields (manual UI edit or conversational agent instruction).
 * Executes within a Mongoose transaction session.
 *
 * @function updateReport
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateReport = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;
  const updates = req.validated?.body || req.body || {};

  const session = await mongoose.startSession();
  try {
    let updatedReport;

    await session.withTransaction(async () => {
      const report = await Report.findOne({
        _id: reportId,
        user: req.user._id,
        isArchived: false,
      }).session(session);

      if (!report) {
        throw new NotFoundError('Report not found or has been archived.');
      }

      // If branch-referencing visits are being updated, verify branch ownership
      const branchIdsToVerify = updates.visits
        ? updates.visits.map((v) => String(v.branch)).filter(Boolean)
        : [];

      if (branchIdsToVerify.length > 0) {
        const uniqueIds = [...new Set(branchIdsToVerify)];
        const branches = await Branch.find({
          _id: { $in: uniqueIds },
          user: req.user._id,
        })
          .session(session)
          .lean();

        if (branches.length !== uniqueIds.length) {
          throw new NotFoundError(
            'One or more updated branches could not be found or do not belong to your account.'
          );
        }
      }

      // Apply allowable operational updates
      if (updates.date !== undefined) report.date = new Date(updates.date);
      if (updates.clockIn !== undefined) report.clockIn = updates.clockIn;
      if (updates.clockOut !== undefined) report.clockOut = updates.clockOut;
      if (updates.visits !== undefined) report.visits = updates.visits;
      if (updates.activities !== undefined) report.activities = updates.activities;
      if (updates.issues !== undefined) report.issues = updates.issues;
      if (updates.comments !== undefined) report.comments = updates.comments;

      await report.save({ session });
      updatedReport = report;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Report updated successfully',
      data: {
        report: updatedReport,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Retrieves the embedded activities subdocument array for a specified report.
 *
 * @function getReportActivities
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getReportActivities = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const report = await Report.findOne({
    _id: reportId,
    user: req.user._id,
  }).select('activities');

  if (!report) {
    throw new NotFoundError('Report not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Report activities retrieved successfully',
    data: {
      activities: report.activities,
    },
  });
});

/**
 * Retrieves the embedded issues subdocument array for a specified report.
 *
 * @function getReportIssues
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getReportIssues = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const report = await Report.findOne({
    _id: reportId,
    user: req.user._id,
  }).select('issues');

  if (!report) {
    throw new NotFoundError('Report not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Report issues retrieved successfully',
    data: {
      issues: report.issues,
    },
  });
});

/**
 * Retrieves the embedded comments subdocument array for a specified report.
 *
 * @function getReportComments
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getReportComments = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const report = await Report.findOne({
    _id: reportId,
    user: req.user._id,
  }).select('comments');

  if (!report) {
    throw new NotFoundError('Report not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Report comments retrieved successfully',
    data: {
      comments: report.comments,
    },
  });
});

/**
 * Soft-archives an active operational report.
 * Initiates the 30-day auto-purge retention window.
 * Executes within a Mongoose transaction session.
 *
 * @function archiveReport
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const archiveReport = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  // Support ?permanent=true query flag
  if (req.query?.permanent === 'true') {
    return deleteReportPermanently(req, res);
  }

  const session = await mongoose.startSession();
  try {
    let archivedReport;

    await session.withTransaction(async () => {
      const report = await Report.findOne({
        _id: reportId,
        user: req.user._id,
      }).session(session);

      if (!report) {
        throw new NotFoundError('Report not found.');
      }

      if (report.isArchived) {
        throw new BadRequestError('Report is already archived.');
      }

      report.isArchived = true;
      report.archivedAt = new Date();

      await report.save({ session });
      archivedReport = report;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Report archived successfully',
      data: {
        report: archivedReport,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Restores a soft-archived operational report before the 30-day auto-purge elapses.
 * Executes within a Mongoose transaction session.
 *
 * @function restoreReport
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const restoreReport = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const session = await mongoose.startSession();
  try {
    let restoredReport;

    await session.withTransaction(async () => {
      const report = await Report.findOne({
        _id: reportId,
        user: req.user._id,
      }).session(session);

      if (!report) {
        throw new NotFoundError('Report not found.');
      }

      if (!report.isArchived) {
        throw new BadRequestError('Report is not archived.');
      }

      report.isArchived = false;
      report.archivedAt = null;

      await report.save({ session });
      restoredReport = report;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Report restored successfully',
      data: {
        report: restoredReport,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Permanently deletes an operational report, removes associated audio metadata,
 * and unlinks audio binaries from disk post-commit.
 * Executes within a Mongoose transaction session.
 *
 * @function deleteReportPermanently
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const deleteReportPermanently = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params || req.params;

  const session = await mongoose.startSession();
  const audioPathsToUnlink = [];

  try {
    await session.withTransaction(async () => {
      const report = await Report.findOne({
        _id: reportId,
        user: req.user._id,
      }).session(session);

      if (!report) {
        throw new NotFoundError('Report not found.');
      }

      if (!report.isArchived) {
        throw new BadRequestError(
          'Only archived reports can be permanently deleted. Please archive the report first.'
        );
      }

      // Collect audio filepaths to unlink after commit
      if (report.audios && report.audios.length > 0) {
        const audioDocs = await Audio.find({
          _id: { $in: report.audios },
          user: req.user._id,
        })
          .select('path')
          .session(session)
          .lean();

        for (const a of audioDocs) {
          if (a.path) {
            audioPathsToUnlink.push(a.path);
          }
        }

        // Remove Audio records from database
        await Audio.deleteMany({
          _id: { $in: report.audios },
          user: req.user._id,
        }).session(session);
      }

      // Hard delete the report document
      await Report.deleteOne({ _id: reportId }).session(session);
    });

    // Post-commit: cleanly unlink associated audio binaries from filesystem
    for (const audioPath of audioPathsToUnlink) {
      try {
        const resolvedPath = path.resolve(audioPath);
        await fs.promises.unlink(resolvedPath);
        logger.info(`[Report Deletion] Unlinked audio binary: ${resolvedPath}`);
      } catch (unlinkErr) {
        if (unlinkErr.code !== 'ENOENT') {
          logger.warn(`[Report Deletion] Failed to unlink audio binary ${audioPath}: ${unlinkErr.message}`);
        }
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Report deleted permanently.',
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Uploads 1 to 5 voice recordings for operational report evidence.
 * Validates cumulative batch size (<=50MB) and persists Audio documents.
 * Executes within a Mongoose transaction session.
 *
 * @function uploadReportAudios
 * @param {import('express').Request} req - Express request object with req.files.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const uploadReportAudios = asyncHandler(async (req, res) => {
  const files = req.files || [];

  if (files.length === 0) {
    throw new BadRequestError('At least one audio file is required.');
  }

  // Validate cumulative batch size cap (50MB)
  const totalBatchBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBatchBytes > AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES) {
    // Clean up newly uploaded files to prevent disk leakage
    for (const file of files) {
      try {
        await fs.promises.unlink(file.path);
      } catch (_) {}
    }
    throw new BadRequestError(
      `Cumulative audio upload size exceeds the ${AUDIO_CONSTANTS.MAX_BATCH_SIZE_BYTES / (1024 * 1024)}MB batch limit.`
    );
  }

  const session = await mongoose.startSession();
  try {
    let createdAudios;

    await session.withTransaction(async () => {
      const audioPayloads = files.map((file) => ({
        user: req.user._id,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path.replace(/\\/g, '/'),
        purpose: 'report_narration',
        status: 'uploaded',
      }));

      createdAudios = await Audio.create(audioPayloads, { session });
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Audio files uploaded successfully',
      data: {
        audios: createdAudios,
      },
    });
  } finally {
    await session.endSession();
  }
});

export default {
  createReport,
  createReportRecord,
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
};
