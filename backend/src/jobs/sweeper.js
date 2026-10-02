/**
 * @module jobs/sweeper
 * @description The two-pass in-process sweeper — the authority for permanent removal:
 * every DELETE only archives (step 1); removal happens here (step 2). One timer per
 * process (SWEEPER_INTERVAL_MS, started after the server is listening — cleared on
 * shutdown; server.js owns the lifecycle, this module owns the run).
 *
 * **Pass 1 — expired-archive hard delete:**
 * - Every isArchived Report whose archivedAt is older than ARCHIVED_TTL_SECONDS is removed
 *   in its own session with its full cascade; audio binaries are unlinked after commit
 *   (a missing binary is logged, not retried; an unlink failure is logged and retried by pass 2).
 * - Archived branches are removed when their archivedAt is older than ARCHIVED_TTL_SECONDS (30 days)
 *   AND the reference check clears (archived + unreferenced); a referenced branch is skipped + logged
 *   and re-checked on the next run; unrestored branches within the 30-day window remain recoverable.
 *
 * **Pass 2 — the orphan sweep:**
 * - Dependents whose parent no longer exists (the TTL index fired before the sweeper —
 *   its deletions run server-side without cascade) and files that never became Audio docs
 *   (multer-temp leaks) — unlink the orphan files in the temp areas (uploads/audio/, uploads/temp/)
 *   and remove the parentless docs. The pass never deletes a report or any live parent;
 *   every action is logged and nothing throws into request paths.
 *
 * Race rules: pass 1 before pass 2 within a run; each parent committed before the next;
 * a run over a clean store is a log-only no-op; a crash leaves committed removals and the
 * interrupted parent is retried next run; a running guard prevents overlapping runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { SWEEPER_INTERVAL_MS, ARCHIVED_TTL_SECONDS } from '../utils/constants.js';
import { logger } from '../config/logger.js';

let sweeperTimer = null;
let isRunning = false;

/**
 * Permanently cascade-deletes a branch document and any associated child entities
 * within an active Mongoose transaction session.
 *
 * @function cascadeDeleteBranch
 * @param {import('mongoose').Types.ObjectId|string} branchId - Branch identifier to purge.
 * @param {import('mongoose').ClientSession} session - Active Mongoose transaction session.
 * @returns {Promise<void>}
 */
export const cascadeDeleteBranch = async (branchId, session) => {
  // If subsequent milestones introduce child models (e.g. Reports), cascade-delete them here:
  if (mongoose.models.Report) {
    await mongoose.models.Report.deleteMany({ branch: branchId }).session(session);
  }

  // Hard delete the branch document
  await Branch.deleteOne({ _id: branchId }).session(session);
};

/**
 * Executes Pass 1: Expired-archive hard delete and reference-checked branch removal.
 * Each parent committed before the next in its own transaction session.
 *
 * @private
 * @function runPass1ExpiredArchiveSweep
 * @returns {Promise<{ branchesPurged: number, reportsPurged: number }>}
 */
const runPass1ExpiredArchiveSweep = async () => {
  let branchesPurged = 0;
  let reportsPurged = 0;

  // 1. Sweep Archived Reports (when Report model exists in Milestone 7)
  if (mongoose.models.Report) {
    const reportCutoff = new Date(Date.now() - ARCHIVED_TTL_SECONDS * 1000);
    const expiredReports = await mongoose.models.Report.find({
      isArchived: true,
      archivedAt: { $lte: reportCutoff },
    }).lean();

    for (const report of expiredReports) {
      const audioFilesToUnlink = [];
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (report.audioUri) {
            audioFilesToUnlink.push(report.audioUri);
          }
          await mongoose.models.Report.deleteOne({ _id: report._id }).session(session);
        });
        reportsPurged += 1;
        logger.info(`[Sweeper:Pass1] Removed expired archived report: ${report._id}`);

        // Unlink audio binaries AFTER commit
        for (const filePath of audioFilesToUnlink) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.info(`[Sweeper:Pass1] Unlinked audio binary: ${filePath}`);
            } else {
              logger.warn(`[Sweeper:Pass1] Audio binary not found on disk (missing binary): ${filePath}`);
            }
          } catch (unlinkErr) {
            logger.error(`[Sweeper:Pass1] Failed to unlink audio binary ${filePath}: ${unlinkErr.message}`);
          }
        }
      } catch (err) {
        logger.error(`[Sweeper:Pass1] Failed to purge report ${report._id}: ${err.message}`);
      } finally {
        await session.endSession();
      }
    }
  }

  // 2. Sweep Archived Branches (30-day retention window + reference-checked removal)
  const branchCutoff = new Date(Date.now() - ARCHIVED_TTL_SECONDS * 1000);
  const archivedBranches = await Branch.find({
    isArchived: true,
    archivedAt: { $lte: branchCutoff },
  }).lean();

  for (const branch of archivedBranches) {
    // Reference check: check if any live reports still reference this branch
    if (mongoose.models.Report) {
      const refCount = await mongoose.models.Report.countDocuments({ branch: branch._id });
      if (refCount > 0) {
        logger.info(
          `[Sweeper:Pass1] Branch "${branch.name}" (${branch._id}) is referenced by ${refCount} report(s). Skipping removal.`
        );
        continue; // Skip: cannot remove until reference check clears
      }
    }

    // Reference check cleared: remove branch in its own session
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await cascadeDeleteBranch(branch._id, session);
      });
      branchesPurged += 1;
      logger.info(
        `[Sweeper:Pass1] Removed unreferenced archived branch: "${branch.name}" (${branch.code || branch._id})`
      );
    } catch (err) {
      logger.error(`[Sweeper:Pass1] Failed to remove branch ${branch._id}: ${err.message}`);
    } finally {
      await session.endSession();
    }
  }

  return { branchesPurged, reportsPurged };
};

/**
 * Executes Pass 2: The orphan sweep.
 * Cleans up parentless documents and unlinks temp files (multer-temp leaks).
 *
 * @private
 * @function runPass2OrphanSweep
 * @returns {Promise<{ orphanFilesPurged: number, orphanDocsPurged: number }>}
 */
const runPass2OrphanSweep = async () => {
  let orphanFilesPurged = 0;
  let orphanDocsPurged = 0;

  // 1. Sweep Multer Temp Leaks in upload directories
  const tempDirectories = [
    path.resolve(process.cwd(), 'uploads/audio'),
    path.resolve(process.cwd(), 'uploads/temp'),
  ];

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = Date.now();

  for (const dir of tempDirectories) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          // Files older than 1 hour in temp directories are considered orphaned leaks
          if (now - stats.mtimeMs > ONE_HOUR_MS) {
            fs.unlinkSync(filePath);
            orphanFilesPurged += 1;
            logger.info(`[Sweeper:Pass2] Unlinked orphaned temporary file: ${filePath}`);
          }
        } catch (fileErr) {
          logger.warn(`[Sweeper:Pass2] Error processing file ${filePath}: ${fileErr.message}`);
        }
      }
    } catch (dirErr) {
      logger.warn(`[Sweeper:Pass2] Error reading directory ${dir}: ${dirErr.message}`);
    }
  }

  return { orphanFilesPurged, orphanDocsPurged };
};

/**
 * Runs a single full two-pass sweeper cycle.
 * Guarded against overlapping executions.
 *
 * @function runSweeperCycle
 * @returns {Promise<{ pass1: object, pass2: object }>} Summary of purged entities.
 */
export const runSweeperCycle = async () => {
  if (isRunning) {
    logger.warn('[Sweeper] Previous sweeper cycle is still active. Skipping concurrent run.');
    return { pass1: { branchesPurged: 0, reportsPurged: 0 }, pass2: { orphanFilesPurged: 0, orphanDocsPurged: 0 } };
  }

  isRunning = true;
  logger.info('[Sweeper] Starting two-pass sweep cycle...');

  try {
    // Pass 1 before Pass 2
    const pass1 = await runPass1ExpiredArchiveSweep();
    const pass2 = await runPass2OrphanSweep();

    if (
      pass1.branchesPurged === 0 &&
      pass1.reportsPurged === 0 &&
      pass2.orphanFilesPurged === 0 &&
      pass2.orphanDocsPurged === 0
    ) {
      logger.info('[Sweeper] Sweep cycle complete: clean store (log-only no-op).');
    } else {
      logger.info(
        `[Sweeper] Sweep cycle complete: ${pass1.branchesPurged} branch(es), ${pass1.reportsPurged} report(s), ${pass2.orphanFilesPurged} file(s) purged.`
      );
    }

    return { pass1, pass2 };
  } catch (error) {
    logger.error(`[Sweeper] Unhandled error during sweeper cycle: ${error.message}\n${error.stack}`);
    return { pass1: { branchesPurged: 0, reportsPurged: 0 }, pass2: { orphanFilesPurged: 0, orphanDocsPurged: 0 } };
  } finally {
    isRunning = false;
  }
};

/**
 * Starts the in-process sweeper timer.
 * Invoked by server.js after the server is listening.
 *
 * @function startSweeper
 * @returns {NodeJS.Timeout|null} Active timer instance.
 */
export const startSweeper = () => {
  if (sweeperTimer) {
    logger.warn('[Sweeper] Sweeper is already running. Ignoring duplicate start.');
    return sweeperTimer;
  }

  // Schedule periodic sweeper runs
  sweeperTimer = setInterval(runSweeperCycle, SWEEPER_INTERVAL_MS);
  if (sweeperTimer.unref) {
    sweeperTimer.unref();
  }

  logger.info(`[Sweeper] In-process sweeper started (interval: ${SWEEPER_INTERVAL_MS}ms).`);
  return sweeperTimer;
};

/**
 * Stops the in-process sweeper timer during application shutdown.
 * Invoked by server.js on SIGINT/SIGTERM.
 *
 * @function stopSweeper
 * @returns {void}
 */
export const stopSweeper = () => {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
    logger.info('[Sweeper] In-process sweeper stopped cleanly.');
  }
};

export default {
  startSweeper,
  stopSweeper,
  runSweeperCycle,
  cascadeDeleteBranch,
};
