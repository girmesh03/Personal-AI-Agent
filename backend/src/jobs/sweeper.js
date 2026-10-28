/**
 * @module jobs/sweeper
 * @description The two-pass in-process sweeper — the authority for permanent removal:
 * every DELETE only archives (step 1); removal happens here (step 2). One timer per
 * process (SWEEPER_INTERVAL_MS, started after the server is listening — cleared on
 * shutdown; server.js owns the lifecycle, this module owns the run).
 *
 * **Pass 1 — expired-archive hard delete:**
 * - Every isArchived Report whose archivedAt is older than ARCHIVED_TTL_SECONDS (30 days)
 *   is removed in its own transaction session with its associated Audio records; physical
 *   audio binaries are unlinked after commit (missing binary is logged, not retried;
 *   unlink failure is logged and retried by pass 2).
 * - Every isArchived standalone Audio whose archivedAt is older than ARCHIVED_TTL_SECONDS
 *   is removed in its own transaction session after verifying it is not referenced by any
 *   active report.
 * - Archived branches are removed when their archivedAt is older than ARCHIVED_TTL_SECONDS
 *   AND the subdocument reference check clears (no reports reference visits.branch);
 *   a referenced branch is skipped + logged to preserve historical audit integrity.
 *
 * **Pass 2 — the orphan sweep:**
 * - Unlinks temporary audio slices in UPLOADS_CONFIG.TEMP_DIR older than 1 hour.
 * - Scans UPLOADS_CONFIG.AUDIOS_DIR and UPLOADS_CONFIG.ATTACHMENTS_DIR for orphaned leaks
 *   older than 24 hours not referenced by any database document.
 * - Strictly protects committed test fixtures and sample assets (audio-sample-*.wav,
 *   transcription-sample-*.txt, etc.) from ever being deleted.
 * - Removes parentless Audio documents whose owning User was deleted from the database.
 *
 * Race rules: pass 1 before pass 2 within a run; each parent committed before the next;
 * a run over a clean store is a log-only no-op; a crash leaves committed removals and the
 * interrupted parent is retried next run; a running guard prevents overlapping runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { Audio } from '../models/Audio.js';
import { Branch } from '../models/Branch.js';
import { Chat } from '../models/Chat.js';
import { User } from '../models/User.js';
import { SWEEPER_INTERVAL_MS, ARCHIVED_TTL_SECONDS, UPLOADS_CONFIG } from '../utils/constants.js';
import { logger } from '../config/logger.js';
import storageService from '../services/storageService.js';

let sweeperTimer = null;
let isRunning = false;

/**
 * Whitelist of committed repository test fixtures and sample assets that must
 * NEVER be deleted by the sweeper, regardless of age or database state.
 * @constant
 * @type {Readonly<Set<string>>}
 */
export const PROTECTED_FIXTURES = Object.freeze(
  new Set([
    'audio-sample-1.wav',
    'audio-sample-2.wav',
    'transcription-sample-1.txt',
    'unrelated-sample-1.txt',
    'transcription-report-sample-1.docx',
    'transcription-report-sample-1.txt',
  ])
);

/**
 * Escapes special regex characters in a string.
 * @function escapeRegex
 * @param {string} str - Raw string.
 * @returns {string} Escaped regex string.
 */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks whether a given filename represents a protected test fixture.
 * @function isProtectedFixture
 * @param {string} fileName - File name to evaluate.
 * @returns {boolean} True if protected.
 */
export const isProtectedFixture = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return false;
  const base = path.basename(fileName);
  if (PROTECTED_FIXTURES.has(base)) return true;
  if (base.startsWith('sample-') || base.includes('-sample-') || base.endsWith('-sample')) return true;
  return false;
};

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
  // 1. Locate all reports referencing this branch to clean up associated audio uploads
  const associatedReports = await Report.find({ 'visits.branch': branchId })
    .select('_id audios')
    .session(session)
    .lean();

  const audioIds = associatedReports.flatMap((r) => r.audios || []).filter(Boolean);

  // 2. Unlink physical audio uploads and remove Audio documents
  if (audioIds.length > 0) {
    const audioDocs = await Audio.find({ _id: { $in: audioIds } })
      .select('path')
      .session(session)
      .lean();

    for (const a of audioDocs) {
      if (a.path && !isProtectedFixture(a.path) && fs.existsSync(a.path)) {
        try {
          fs.unlinkSync(a.path);
          logger.info(`[CascadeDelete] Unlinked audio upload: ${a.path}`);
        } catch (unlinkErr) {
          logger.warn(`[CascadeDelete] Failed to unlink audio upload ${a.path}: ${unlinkErr.message}`);
        }
      }
    }

    await Audio.deleteMany({ _id: { $in: audioIds } }).session(session);
  }

  // 3. Purge any reports referencing this branch in visits subdocument
  await Report.deleteMany({ 'visits.branch': branchId }).session(session);

  // 4. Hard delete the branch document
  await Branch.deleteOne({ _id: branchId }).session(session);
};

/**
 * Executes Pass 1: Expired-archive hard delete and reference-checked branch removal.
 * Each parent committed before the next in its own transaction session.
 *
 * @private
 * @function runPass1ExpiredArchiveSweep
 * @returns {Promise<{ branchesPurged: number, reportsPurged: number, audiosPurged: number }>}
 */
const runPass1ExpiredArchiveSweep = async () => {
  let branchesPurged = 0;
  let reportsPurged = 0;
  let audiosPurged = 0;

  const cutoff = new Date(Date.now() - ARCHIVED_TTL_SECONDS * 1000);

  // 1. Sweep Archived Reports (expired past 30-day retention)
  const expiredReports = await Report.find({
    isArchived: true,
    archivedAt: { $lte: cutoff },
  }).lean();

  for (const report of expiredReports) {
    const audioFilesToUnlink = [];
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Collect associated Audio records and their disk filepaths
        if (report.audios && report.audios.length > 0) {
          const audioDocs = await Audio.find({
            _id: { $in: report.audios },
          })
            .select('path publicId')
            .session(session)
            .lean();

          for (const a of audioDocs) {
            if (a.path) {
              audioFilesToUnlink.push(a.path);
            }
          }

          // Vector 7: Clean up Cloud CDN assets
          void storageService.cleanupReportAudios(audioDocs);

          // Delete associated Audio documents in session
          await Audio.deleteMany({ _id: { $in: report.audios } }).session(session);
        }

        // Hard delete the Report document
        await Report.deleteOne({ _id: report._id }).session(session);
      });
      reportsPurged += 1;
      logger.info(`[Sweeper:Pass1] Removed expired archived report: ${report._id}`);

      // Unlink audio binaries AFTER commit
      for (const filePath of audioFilesToUnlink) {
        try {
          const resolvedPath = path.resolve(filePath);
          if (fs.existsSync(resolvedPath)) {
            await fs.promises.unlink(resolvedPath);
            logger.info(`[Sweeper:Pass1] Unlinked audio binary: ${resolvedPath}`);
          } else {
            logger.warn(`[Sweeper:Pass1] Audio binary not found on disk: ${resolvedPath}`);
          }
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') {
            logger.error(`[Sweeper:Pass1] Failed to unlink audio binary ${filePath}: ${unlinkErr.message}`);
          }
        }
      }
    } catch (err) {
      logger.error(`[Sweeper:Pass1] Failed to purge report ${report._id}: ${err.message}`);
    } finally {
      await session.endSession();
    }
  }

  // 2. Sweep Standalone Archived Audios (expired past 30-day retention)
  const expiredAudios = await Audio.find({
    isArchived: true,
    archivedAt: { $lte: cutoff },
  }).lean();

  for (const audio of expiredAudios) {
    // Safety guard: Ensure audio is not referenced by any active report
    const refCount = await Report.countDocuments({ audios: audio._id, isArchived: false });
    if (refCount > 0) {
      logger.warn(
        `[Sweeper:Pass1] Archived audio ${audio._id} is referenced by an active report. Skipping removal.`
      );
      continue;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Audio.deleteOne({ _id: audio._id }).session(session);
      });
      audiosPurged += 1;
      logger.info(`[Sweeper:Pass1] Removed expired archived standalone audio: ${audio._id}`);

      if (audio.path) {
        const resolvedPath = path.resolve(audio.path);
        if (fs.existsSync(resolvedPath)) {
          await fs.promises.unlink(resolvedPath);
          logger.info(`[Sweeper:Pass1] Unlinked standalone audio binary: ${resolvedPath}`);
        }
      }
    } catch (err) {
      logger.error(`[Sweeper:Pass1] Failed to purge audio ${audio._id}: ${err.message}`);
    } finally {
      await session.endSession();
    }
  }

  // 3. Sweep Archived Branches (30-day retention + subdocument visits reference check)
  const archivedBranches = await Branch.find({
    isArchived: true,
    archivedAt: { $lte: cutoff },
  }).lean();

  for (const branch of archivedBranches) {
    // Check if any report still references this branch in visits array
    const refCount = await Report.countDocuments({ 'visits.branch': branch._id });
    if (refCount > 0) {
      logger.info(
        `[Sweeper:Pass1] Branch "${branch.name}" (${branch._id}) is referenced by ${refCount} report(s). Skipping removal to preserve historical audit integrity.`
      );
      continue; // Skip: protect multi-branch audit history
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

  return { branchesPurged, reportsPurged, audiosPurged };
};

/**
 * Executes Pass 2: The orphan sweep.
 * Cleans up ephemeral scratch chunks in temp/, unreferenced upload leaks in audios/ and attachments/,
 * and parentless database records. Strictly preserves protected test fixtures.
 *
 * @private
 * @function runPass2OrphanSweep
 * @returns {Promise<{ orphanFilesPurged: number, orphanDocsPurged: number }>}
 */
const runPass2OrphanSweep = async () => {
  let orphanFilesPurged = 0;
  let orphanDocsPurged = 0;

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // 1. Sweep Ephemeral Scratch Chunks in UPLOADS_CONFIG.TEMP_DIR (older than 1 hour)
  if (fs.existsSync(UPLOADS_CONFIG.TEMP_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_CONFIG.TEMP_DIR);
      for (const file of files) {
        const filePath = path.join(UPLOADS_CONFIG.TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > ONE_HOUR_MS) {
            await fs.promises.unlink(filePath);
            orphanFilesPurged += 1;
            logger.info(`[Sweeper:Pass2] Unlinked orphaned temporary chunk: ${filePath}`);
          }
        } catch (fileErr) {
          logger.warn(`[Sweeper:Pass2] Error processing temporary chunk ${filePath}: ${fileErr.message}`);
        }
      }
    } catch (dirErr) {
      logger.warn(`[Sweeper:Pass2] Error reading temp directory: ${dirErr.message}`);
    }
  }

  // 2. Sweep Abandoned Upload Leaks in UPLOADS_CONFIG.AUDIOS_DIR (older than 24 hours, unreferenced in DB)
  if (fs.existsSync(UPLOADS_CONFIG.AUDIOS_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_CONFIG.AUDIOS_DIR);
      for (const file of files) {
        // Strictly protect committed fixtures and sample files
        if (isProtectedFixture(file)) continue;

        const filePath = path.join(UPLOADS_CONFIG.AUDIOS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > TWENTY_FOUR_HOURS_MS) {
            const fileRegex = new RegExp(escapeRegex(file), 'i');
            const isReferenced = await Audio.exists({
              $or: [{ path: fileRegex }, { fileName: file }],
            });

            if (!isReferenced) {
              await fs.promises.unlink(filePath);
              orphanFilesPurged += 1;
              logger.info(`[Sweeper:Pass2] Unlinked orphaned audio leak: ${filePath}`);
            }
          }
        } catch (fileErr) {
          logger.warn(`[Sweeper:Pass2] Error processing audio file ${filePath}: ${fileErr.message}`);
        }
      }
    } catch (dirErr) {
      logger.warn(`[Sweeper:Pass2] Error reading audios directory: ${dirErr.message}`);
    }
  }

  // 3. Sweep Abandoned Upload Leaks in UPLOADS_CONFIG.ATTACHMENTS_DIR (older than 24 hours, unreferenced in DB)
  if (fs.existsSync(UPLOADS_CONFIG.ATTACHMENTS_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_CONFIG.ATTACHMENTS_DIR);
      for (const file of files) {
        // Strictly protect committed fixtures and sample files
        if (isProtectedFixture(file)) continue;

        const filePath = path.join(UPLOADS_CONFIG.ATTACHMENTS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > TWENTY_FOUR_HOURS_MS) {
            const fileRegex = new RegExp(escapeRegex(file), 'i');
            const isReferenced = await Chat.exists({
              $or: [
                { 'messages.attachments.path': fileRegex },
                { 'messages.attachments.fileName': file },
              ],
            });

            if (!isReferenced) {
              await fs.promises.unlink(filePath);
              orphanFilesPurged += 1;
              logger.info(`[Sweeper:Pass2] Unlinked orphaned attachment leak: ${filePath}`);
            }
          }
        } catch (fileErr) {
          logger.warn(`[Sweeper:Pass2] Error processing attachment file ${filePath}: ${fileErr.message}`);
        }
      }
    } catch (dirErr) {
      logger.warn(`[Sweeper:Pass2] Error reading attachments directory: ${dirErr.message}`);
    }
  }

  // 4. Vector 5: Sweep Abandoned Staged Uploads older than 2 hours never bound to a chat or report
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stagedAudios = await Audio.find({
      status: 'uploaded',
      createdAt: { $lte: twoHoursAgo },
      purpose: 'chat_voice_input',
    })
      .select('path publicId')
      .lean();

    for (const aud of stagedAudios) {
      if (isProtectedFixture(aud.path)) continue;
      const isUsedInChat = await Chat.exists({ 'messages.audios': aud._id });
      const isUsedInReport = await Report.exists({ audios: aud._id });
      if (!isUsedInChat && !isUsedInReport) {
        if (aud.publicId) {
          void storageService.destroyFile(aud.publicId, 'video');
        }
        if (aud.path && fs.existsSync(aud.path)) {
          try {
            await fs.promises.unlink(aud.path);
          } catch (_) {}
        }
        await Audio.deleteOne({ _id: aud._id });
        orphanFilesPurged += 1;
        logger.info(`[Sweeper:Pass2] Purged abandoned staged audio: ${aud._id}`);
      }
    }
  } catch (stagedErr) {
    logger.warn(`[Sweeper:Pass2] Error sweeping abandoned staged audios: ${stagedErr.message}`);
  }

  // 5. Sweep Ephemeral Generated Documents in uploads/generated_documents/ (older than 24 hours)
  const generatedDocsDir = path.resolve(process.cwd(), 'backend/uploads/generated_documents');
  if (fs.existsSync(generatedDocsDir)) {
    try {
      const files = fs.readdirSync(generatedDocsDir);
      for (const file of files) {
        if (isProtectedFixture(file)) continue;
        const filePath = path.join(generatedDocsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > TWENTY_FOUR_HOURS_MS) {
            await fs.promises.unlink(filePath);
            orphanFilesPurged += 1;
            logger.info(`[Sweeper:Pass2] Unlinked expired generated document: ${filePath}`);
          }
        } catch (fileErr) {
          logger.warn(`[Sweeper:Pass2] Error processing generated document ${filePath}: ${fileErr.message}`);
        }
      }
    } catch (dirErr) {
      logger.warn(`[Sweeper:Pass2] Error reading generated documents directory: ${dirErr.message}`);
    }
  }

  // 6. Sweep Parentless Audio Database Records (whose owning User no longer exists)
  try {
    const audios = await Audio.find({}).select('user').lean();
    for (const a of audios) {
      if (a.user) {
        const userExists = await User.exists({ _id: a.user });
        if (!userExists) {
          await Audio.deleteOne({ _id: a._id });
          orphanDocsPurged += 1;
          logger.info(`[Sweeper:Pass2] Removed parentless Audio doc: ${a._id}`);
        }
      }
    }
  } catch (docErr) {
    logger.warn(`[Sweeper:Pass2] Error checking parentless Audio docs: ${docErr.message}`);
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
    return {
      pass1: { branchesPurged: 0, reportsPurged: 0, audiosPurged: 0 },
      pass2: { orphanFilesPurged: 0, orphanDocsPurged: 0 },
    };
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
      pass1.audiosPurged === 0 &&
      pass2.orphanFilesPurged === 0 &&
      pass2.orphanDocsPurged === 0
    ) {
      logger.info('[Sweeper] Sweep cycle complete: clean store (log-only no-op).');
    } else {
      logger.info(
        `[Sweeper] Sweep cycle complete: ${pass1.branchesPurged} branch(es), ${pass1.reportsPurged} report(s), ${pass1.audiosPurged} audio(s), ${pass2.orphanFilesPurged} file(s), ${pass2.orphanDocsPurged} doc(s) purged.`
      );
    }

    return { pass1, pass2 };
  } catch (error) {
    logger.error(`[Sweeper] Unhandled error during sweeper cycle: ${error.message}\n${error.stack}`);
    return {
      pass1: { branchesPurged: 0, reportsPurged: 0, audiosPurged: 0 },
      pass2: { orphanFilesPurged: 0, orphanDocsPurged: 0 },
    };
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
  PROTECTED_FIXTURES,
  isProtectedFixture,
};
