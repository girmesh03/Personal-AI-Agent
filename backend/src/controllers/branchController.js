/**
 * @module controllers/branchController
 * @description Controller managing operational branch CRUD, directory search, pagination,
 * soft archival, restoration, and cascade permanent deletion scoped strictly to the authenticated supervisor.
 * All write operations strictly execute within Mongoose transaction sessions for ACID integrity.
 */

import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Branch } from '../models/Branch.js';
import { HTTP_STATUS, DEFAULT_PAGE_LIMIT } from '../utils/constants.js';
import { ConflictError, NotFoundError, BadRequestError } from '../errors/CustomError.js';
import {
  generateBranchCode,
  resolveBranchAliases,
  getBilingualSearchTerms,
} from '../utils/transliterate.js';
import { cascadeDeleteBranch } from '../jobs/sweeper.js';

/**
 * Escapes characters with special meaning in regular expressions.
 * @private
 * @param {string} str - String to escape.
 * @returns {string} Escaped string safe for RegExp construction.
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Builds the MongoDB query filter for a branch identifier that may be either an ObjectId or an operational code.
 * Scoped strictly to the authenticated supervisor.
 *
 * @private
 * @param {string} identifier - 24-hex Mongo ObjectId or operational branch code (e.g. 'BOLE-01').
 * @param {string|import('mongoose').Types.ObjectId} userId - Supervisor identifier.
 * @returns {object} Mongo query object.
 */
const buildBranchIdentifierQuery = (identifier, userId) => {
  const cleanId = String(identifier || '').trim();
  const isMongoId =
    mongoose.Types.ObjectId.isValid(cleanId) &&
    String(new mongoose.Types.ObjectId(cleanId)) === cleanId;

  if (isMongoId) {
    return {
      user: userId,
      _id: cleanId,
    };
  }

  return {
    user: userId,
    code: cleanId.toUpperCase(),
  };
};

/**
 * Creates a new physical operational branch location for the authenticated supervisor.
 * Automatically derives bilingual search aliases and auto-generates operational branch code.
 * Executes within a Mongoose transaction session.
 *
 * @function createBranch
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const createBranch = asyncHandler(async (req, res) => {
  const validatedBody = req.validated?.body || req.body || {};
  const { name, location, managerName, contactPhone } = validatedBody;
  const cleanName = (name || '').trim();

  const session = await mongoose.startSession();
  try {
    let createdBranch;

    await session.withTransaction(async () => {
      // 1. Case-insensitive collision check for active branch name
      const nameRegex = new RegExp(`^${escapeRegex(cleanName)}$`, 'i');
      const existingByName = await Branch.findOne({
        user: req.user._id,
        name: nameRegex,
        isArchived: false,
      }).session(session);

      if (existingByName) {
        throw new ConflictError('A branch with this name already exists.');
      }

      // 2. Auto-generate uppercase operational code from supervisor's existing codes
      const existingBranches = await Branch.find({ user: req.user._id })
        .select('code')
        .session(session)
        .lean();
      const existingCodes = existingBranches.map((b) => b.code);
      const branchCode = generateBranchCode(cleanName, existingCodes);

      // 3. Resolve bilingual search aliases (Amharic <-> English transliterations)
      const aliases = resolveBranchAliases(cleanName);

      // 4. Create branch document inside the active transaction
      const [newBranch] = await Branch.create(
        [
          {
            user: req.user._id,
            name: cleanName,
            code: branchCode,
            aliases,
            location: {
              city: location?.city?.trim() || undefined,
              subcity: location?.subcity?.trim() || '',
              address: location?.address?.trim() || '',
            },
            managerName: managerName?.trim() || '',
            contactPhone: contactPhone?.trim() || '',
          },
        ],
        { session }
      );

      createdBranch = newBranch;
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Branch created successfully',
      data: {
        branch: createdBranch,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Retrieves a paginated list of branches with bilingual text search and archival filter.
 * Enables finding Amharic branches using English transliterated queries and vice versa.
 *
 * @function getBranches
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getBranches = asyncHandler(async (req, res) => {
  const queryParams = req.validated?.query || req.query || {};
  const { page, limit, search, isArchived, archived } = queryParams;

  // By default, archived branches (isArchived: true) are strictly excluded
  let isArchivedFilter = false;
  if (archived !== undefined) {
    isArchivedFilter = archived === true || archived === 'true' || archived === '';
  } else if (isArchived !== undefined) {
    isArchivedFilter = isArchived === true || isArchived === 'true' || isArchived === '';
  }

  const query = {
    user: req.user._id,
    isArchived: isArchivedFilter,
  };

  if (search && search.trim()) {
    const searchTerms = getBilingualSearchTerms(search.trim());
    const termOrConditions = searchTerms.flatMap((term) => {
      const termRegex = new RegExp(escapeRegex(term), 'i');
      return [
        { name: termRegex },
        { code: termRegex },
        { aliases: termRegex },
        { managerName: termRegex },
        { 'location.address': termRegex },
        { 'location.subcity': termRegex },
      ];
    });

    query.$or = termOrConditions;
  }

  const options = {
    page: parseInt(page, 10) || 1,
    limit: Math.min(parseInt(limit, 10) || DEFAULT_PAGE_LIMIT, 100),
    sort: { createdAt: -1 },
    customLabels: {
      docs: 'branches',
      totalDocs: 'totalBranches',
    },
  };

  const result = await Branch.paginate(query, options);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Branches retrieved successfully',
    data: {
      branches: result.branches,
      pagination: {
        total: result.totalBranches,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    },
  });
});

/**
 * Retrieves a single branch by its identifier, scoped strictly to the authenticated supervisor.
 *
 * @function getBranchById
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getBranchById = asyncHandler(async (req, res) => {
  const { branchId } = req.validated?.params || req.params;

  const query = buildBranchIdentifierQuery(branchId, req.user._id);
  const branch = await Branch.findOne(query);

  if (!branch) {
    throw new NotFoundError('Branch not found.');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Branch details retrieved successfully',
    data: {
      branch,
    },
  });
});

/**
 * Updates operational branch attributes. Validates active name and code collisions.
 * Executes within a Mongoose transaction session.
 *
 * @function updateBranch
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const updateBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const updates = req.validated?.body || req.body || {};

  const session = await mongoose.startSession();
  try {
    let updatedBranch;

    await session.withTransaction(async () => {
      const query = {
        ...buildBranchIdentifierQuery(branchId, req.user._id),
        isArchived: false,
      };
      const branch = await Branch.findOne(query).session(session);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }

      // Check name uniqueness if updated
      if (updates.name && updates.name.trim() !== branch.name) {
        const cleanName = updates.name.trim();
        const nameRegex = new RegExp(`^${escapeRegex(cleanName)}$`, 'i');

        const collidingName = await Branch.findOne({
          _id: { $ne: branch._id },
          user: req.user._id,
          name: nameRegex,
          isArchived: false,
        }).session(session);

        if (collidingName) {
          throw new ConflictError('A branch with this name already exists.');
        }

        branch.name = cleanName;
        branch.aliases = resolveBranchAliases(cleanName);
      }

      // Update location attributes
      if (updates.location) {
        if (updates.location.city !== undefined) branch.location.city = updates.location.city.trim();
        if (updates.location.subcity !== undefined) branch.location.subcity = updates.location.subcity.trim();
        if (updates.location.address !== undefined) branch.location.address = updates.location.address.trim();
      }

      // Update manager & contact details
      if (updates.managerName !== undefined) branch.managerName = updates.managerName.trim();
      if (updates.contactPhone !== undefined) branch.contactPhone = updates.contactPhone.trim();

      await branch.save({ session });
      updatedBranch = branch;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch updated successfully',
      data: {
        branch: updatedBranch,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Soft-archives an active branch location.
 * Executes within a Mongoose transaction session.
 *
 * @function archiveBranch
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const archiveBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.validated?.params || req.params;

  // If permanent query flag is set, delegate to permanent deletion
  if (req.query?.permanent === 'true') {
    return deleteBranchPermanently(req, res);
  }

  const session = await mongoose.startSession();
  try {
    let archivedBranch;

    await session.withTransaction(async () => {
      const query = buildBranchIdentifierQuery(branchId, req.user._id);
      const branch = await Branch.findOne(query).session(session);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }

      if (branch.isArchived) {
        throw new BadRequestError('Branch is already archived.');
      }

      branch.isArchived = true;
      branch.archivedAt = new Date();

      await branch.save({ session });
      archivedBranch = branch;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch archived successfully',
      data: {
        branch: archivedBranch,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Restores a soft-archived branch. Guards against active name and code collisions.
 * Executes within a Mongoose transaction session.
 *
 * @function restoreBranch
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const restoreBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.validated?.params || req.params;

  const session = await mongoose.startSession();
  try {
    let restoredBranch;

    await session.withTransaction(async () => {
      const query = buildBranchIdentifierQuery(branchId, req.user._id);
      const branch = await Branch.findOne(query).session(session);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }

      if (!branch.isArchived) {
        throw new BadRequestError('Branch is already active and cannot be restored.');
      }

      // Guard: active name collision check
      const nameRegex = new RegExp(`^${escapeRegex(branch.name)}$`, 'i');
      const collidingName = await Branch.findOne({
        _id: { $ne: branch._id },
        user: req.user._id,
        name: nameRegex,
        isArchived: false,
      }).session(session);

      if (collidingName) {
        throw new ConflictError(
          'An active branch with this name already exists. Please resolve the collision before restoring.'
        );
      }

      // Guard: active code collision check
      const collidingCode = await Branch.findOne({
        _id: { $ne: branch._id },
        user: req.user._id,
        code: branch.code,
        isArchived: false,
      }).session(session);

      if (collidingCode) {
        throw new ConflictError(
          'An active branch with this operational code already exists. Please resolve the collision before restoring.'
        );
      }

      branch.isArchived = false;
      branch.archivedAt = null;

      await branch.save({ session });
      restoredBranch = branch;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch restored successfully',
      data: {
        branch: restoredBranch,
      },
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Permanently hard-deletes an archived branch and cascades deletion to child resources.
 * Only archived branches can be permanently deleted (user get archived -> delete -> confirm dialog -> delete).
 * Executes within a Mongoose transaction session.
 *
 * @function deleteBranchPermanently
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const deleteBranchPermanently = asyncHandler(async (req, res) => {
  const { branchId } = req.validated?.params || req.params;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const query = buildBranchIdentifierQuery(branchId, req.user._id);
      const branch = await Branch.findOne(query).session(session);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }

      if (!branch.isArchived) {
        throw new BadRequestError('Only archived branches can be permanently deleted. Please archive the branch first.');
      }

      // Cascade hard delete branch and child entities in session using canonical _id
      await cascadeDeleteBranch(branch._id, session);
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Branch permanently deleted successfully',
      data: null,
    });
  } finally {
    await session.endSession();
  }
});

export default {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  archiveBranch,
  restoreBranch,
  deleteBranchPermanently,
};

