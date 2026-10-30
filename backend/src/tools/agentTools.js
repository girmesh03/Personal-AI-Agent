/**
 * @module tools/agentTools
 * @description Comprehensive autonomous agent tool suite and execution engine for Google GenAI (Gemini).
 * Defines native @google/genai FunctionDeclaration schemas for the complete 17-Tool Enterprise Operational Matrix
 * and in-process ACID execution handlers.
 */

import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { Type } from '@google/genai';
import { Branch } from '../models/Branch.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { Audio } from '../models/Audio.js';
import { REPORT_CONSTANTS, BRANCH_CONSTANTS, CHAT_CONSTANTS, AI_MODELS } from '../utils/constants.js';
import { toEthiopianDateString, toGregorianDate } from '../utils/ethiopianCalendar.js';
import { isValidObjectId, validateReportPayload } from '../validations/reportValidation.js';
import { createReportRecord } from '../controllers/reportController.js';
import {
  generateBranchCode,
  resolveBranchAliases,
  getBilingualSearchTerms,
} from '../utils/transliterate.js';
import { cascadeDeleteBranch } from '../jobs/sweeper.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../errors/CustomError.js';
import logger from '../config/logger.js';
import {
  dispatchToTelegram,
  resolveBotToken,
  resolveChannelChatId,
} from '../services/telegramService.js';
import { manageGoogleDrive, createCloudDocument } from '../services/googleDriveService.js';
import { generateDocumentFile } from '../services/documentGenerationService.js';

/**
 * Escapes characters with special meaning in regular expressions.
 *
 * @private
 * @param {string} str - String to escape.
 * @returns {string} Escaped string safe for RegExp construction.
 */
function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes user/LLM input issue status to canonical domain status enum.
 * Authoritative: 'reported' | 'completed' | 'in_progress' | 'no_issue'
 * @function normalizeIssueStatus
 * @param {string|undefined|null} status - Raw status from LLM/user.
 * @returns {'reported'|'completed'|'in_progress'|'no_issue'}
 */
export function normalizeIssueStatus(status) {
  if (!status || typeof status !== 'string') return 'reported';
  const clean = status.trim().toLowerCase().replace(/[\s_-]+/g, '_');

  if (['completed', 'resolved', 'done', 'fixed', 'closed'].includes(clean)) {
    return 'completed';
  }
  if (['in_progress', 'ongoing', 'progress', 'investigating', 'working_on'].includes(clean)) {
    return 'in_progress';
  }
  if (['no_issue', 'none', 'no_issues', 'ok', 'normal', 'good'].includes(clean)) {
    return 'no_issue';
  }
  if (['reported', 'open', 'pending', 'unresolved', 'new', 'active'].includes(clean)) {
    return 'reported';
  }
  return 'reported';
}

/**
 * Normalizes user/LLM input activity status to canonical domain status enum.
 * Authoritative: 'completed' | 'in_progress'
 * @function normalizeActivityStatus
 * @param {string|undefined|null} status - Raw status from LLM/user.
 * @returns {'completed'|'in_progress'}
 */
export function normalizeActivityStatus(status) {
  if (!status || typeof status !== 'string') return 'completed';
  const clean = status.trim().toLowerCase().replace(/[\s_-]+/g, '_');

  if (['in_progress', 'ongoing', 'progress', 'started', 'pending'].includes(clean)) {
    return 'in_progress';
  }
  if (['completed', 'done', 'finished', 'closed', 'resolved'].includes(clean)) {
    return 'completed';
  }
  return 'completed';
}

/**
 * Builds the MongoDB query filter for a branch identifier that may be either an ObjectId or an operational code.
 *
 * @private
 * @param {string} identifier - 24-hex Mongo ObjectId or operational branch code (e.g. 'BOLE-01').
 * @param {string|import('mongoose').Types.ObjectId} userId - Supervisor identifier.
 * @returns {object} Mongo query object.
 */
function buildBranchIdentifierQuery(identifier, userId) {
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
}

/**
 * Resolves an array of branch identifiers (ObjectIds or codes) to an array of valid MongoDB ObjectIds.
 *
 * @private
 * @param {Array<string>} identifiers - Array of branch IDs or codes.
 * @param {string|import('mongoose').Types.ObjectId} userId - Supervisor identifier.
 * @param {import('mongoose').ClientSession} [session=null] - Optional Mongoose session.
 * @returns {Promise<Array<import('mongoose').Types.ObjectId>>} Resolved ObjectIds.
 */
async function resolveBranchObjectIds(identifiers, userId, session = null) {
  if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) return [];
  const resolvedIds = [];
  const pendingIdentifiers = [];

  for (const item of identifiers) {
    const clean = String(item || '').trim();
    if (mongoose.Types.ObjectId.isValid(clean) && String(new mongoose.Types.ObjectId(clean)) === clean) {
      resolvedIds.push(new mongoose.Types.ObjectId(clean));
    } else if (clean) {
      pendingIdentifiers.push(clean);
    }
  }

  if (pendingIdentifiers.length > 0) {
    const uppercaseCodes = pendingIdentifiers.map((s) => s.toUpperCase());
    const found = await Branch.find({
      user: userId,
      $or: [
        { code: { $in: uppercaseCodes } },
        { name: { $in: pendingIdentifiers } },
      ],
    })
      .select('_id')
      .session(session || null)
      .lean();
    for (const b of found) {
      resolvedIds.push(b._id);
    }
  }

  return resolvedIds;
}

/**
 * Executes a callback within a Mongoose transaction session.
 * Reuses existing session if provided, otherwise creates and commits a new transaction.
 *
 * @private
 * @template T
 * @param {import('mongoose').ClientSession|null} existingSession - Existing session if any.
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} callback - Async logic to execute.
 * @returns {Promise<T>} Result of callback.
 */
async function runInTransaction(existingSession, callback) {
  if (existingSession) {
    return await callback(existingSession);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * ==============================================================================
 * 1. Native @google/genai Function Declarations (The Complete 17-Tool Matrix)
 * ==============================================================================
 */
export const agentToolDeclarations = [
  // ==========================================
  // CATEGORY 1: BRANCH SCOPE (6 TOOLS)
  // ==========================================
  {
    name: 'lookup_user_branches',
    description:
      'Retrieve restaurant branches registered to the authenticated supervisor. Supports filtering by active, archived, or all status, plus keyword search.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: "Status filter: 'active' (default), 'archived', or 'all'.",
        },
        search: {
          type: Type.STRING,
          description: 'Optional keyword to search branch name, code, address, or manager.',
        },
      },
    },
  },
  {
    name: 'create_branch',
    description:
      'Register a new restaurant branch for the supervisor inside an ACID transaction. Automatically generates unique branch code (e.g. BOLE-01) and Amharic transliteration.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Official name of the branch (e.g., ቦሌ መድኃኒዓለም or Bole Medhanialem).',
        },
        address: {
          type: Type.STRING,
          description: 'Physical location or street address in Addis Ababa.',
        },
        phone: {
          type: Type.STRING,
          description: 'Contact phone number (e.g., 0911223344).',
        },
        managerName: {
          type: Type.STRING,
          description: 'Full name of the designated branch manager.',
        },
      },
      required: ['name', 'address', 'phone', 'managerName'],
    },
  },
  {
    name: 'update_branch',
    description:
      'Update profile details of an existing branch (manager name, contact phone, location address, or name) inside an ACID session.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: {
          type: Type.STRING,
          description: 'MongoDB ObjectId or unique branch code (e.g., BOLE-01).',
        },
        name: {
          type: Type.STRING,
          description: 'Updated branch name.',
        },
        address: {
          type: Type.STRING,
          description: 'Updated physical address.',
        },
        phone: {
          type: Type.STRING,
          description: 'Updated contact phone number.',
        },
        managerName: {
          type: Type.STRING,
          description: 'Updated manager name.',
        },
      },
      required: ['branchId'],
    },
  },
  {
    name: 'archive_branch',
    description:
      'Soft-archive an active branch (e.g. during remodeling, kitchen repairs, or temporary closure). Prevents branch from appearing in daily operational audits.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: {
          type: Type.STRING,
          description: 'MongoDB ObjectId or branch code of the branch to archive.',
        },
      },
      required: ['branchId'],
    },
  },
  {
    name: 'restore_branch',
    description:
      'Restore a previously archived branch back to active status. Enforces unique active name and code collision guards.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: {
          type: Type.STRING,
          description: 'MongoDB ObjectId or branch code of the archived branch to restore.',
        },
      },
      required: ['branchId'],
    },
  },
  {
    name: 'delete_branch_permanently',
    description:
      'Permanently hard-delete an archived branch. Must be archived first. Cascades cleanup inside an ACID session.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: {
          type: Type.STRING,
          description: 'MongoDB ObjectId or branch code of the archived branch to permanently delete.',
        },
      },
      required: ['branchId'],
    },
  },

  // ==========================================
  // CATEGORY 2: REPORT SCOPE (6 TOOLS)
  // ==========================================
  {
    name: 'create_report',
    description:
      'Autonomously formats and persists an authoritative operational report adhering to the Single-Branch or Multi-Branch corporate template, embedding visits, activities, issues, and comments directly in MongoDB via validateReportPayload and createReportRecord. Zero user tool approval required.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Inspection date. Either a valid ISO date string (YYYY-MM-DD) or Ethiopian calendar date (DD-MM-YY or DD/MM/YYYY). Must be today or a past date, never in the future.',
        },
        clockIn: {
          type: Type.STRING,
          description: 'Work shift start time formatted strictly as HH:mm (ስራ የገባሁበት ሰዓት).',
        },
        clockOut: {
          type: Type.STRING,
          description: 'Work shift end time formatted strictly as HH:mm (ከስራ የወጣሁበት ሰዓት).',
        },
        visits: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              branch: {
                type: Type.STRING,
                description: 'MongoDB ObjectId, operational branch code (e.g. BOLE-01), or exact registered branch name of the visited branch. Must correspond to an active registered branch in <branch_registry>. Never forge an arbitrary ID for an unregistered branch.',
              },
              clockIn: {
                type: Type.STRING,
                description: 'Branch arrival time formatted strictly as HH:mm.',
              },
              clockOut: {
                type: Type.STRING,
                description: 'Branch departure time formatted strictly as HH:mm.',
              },
            },
            required: ['branch', 'clockIn', 'clockOut'],
          },
          description:
            'Chronological list of physical branch visits. Exactly 1 for Single-Branch, 2 or more for Multi-Branch.',
        },
        transcription: {
          type: Type.STRING,
          description:
            'Complete formatted Amharic corporate text matching the Single-Branch or Multi-Branch template.',
        },
        audios: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Optional array of 24-character hexadecimal MongoDB ObjectIds of standalone Audio documents.',
        },
        activities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'Operational task or activity conducted (- [ስራ]).',
              },
              status: {
                type: Type.STRING,
                description: "Activity status: 'in_progress' or 'completed' (default: 'completed').",
              },
            },
            required: ['text'],
          },
          description: 'Extracted operational activities (የተሰሩ ስራዎች).',
        },
        issues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'Operational issue description (- [ችግር]).',
              },
              status: {
                type: Type.STRING,
                description:
                  "Issue status: 'reported', 'completed', 'in_progress', or 'no_issue' (default: 'reported').",
              },
            },
            required: ['text'],
          },
          description: 'Extracted operational issues or malfunctions (መፍትሄ የሚፈልጉ ጉዳዮች).',
        },
        comments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'General comment or observational remark (- [አስተያየት]). Comments have NO status.',
              },
            },
            required: ['text'],
          },
          description: 'Extracted operational comments (አጠቃላይ አስተያየት).',
        },
        customSections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              heading: {
                type: Type.STRING,
                description: 'Custom report section heading (e.g. የጥሬ ገንዘብ ሂሳብ ማጠቃለያ, የማቀዝቀዣ ሙቀት መዝገብ).',
              },
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Bullet points, line items, or entries belonging to this section.',
              },
            },
            required: ['heading', 'items'],
          },
          description: 'Optional custom report sections defined in user settings report templates.',
        },
      },
      required: ['date', 'clockIn', 'clockOut', 'visits', 'transcription'],
    },
  },
  {
    name: 'update_report',
    description:
      'Amend an existing operational report (work hours, new activities, new issues, comments, or transcription) inside an ACID session. Can identify the report either by reportId OR by date (defaults to current day if reportId is omitted).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description:
            '24-character hexadecimal MongoDB ObjectId of the report to amend. Optional if date is supplied or amending today\'s report.',
        },
        date: {
          type: Type.STRING,
          description:
            'Inspection date of the report to amend (YYYY-MM-DD or DD-MM-YY). Used to look up the report in MongoDB if reportId is omitted.',
        },
        clockIn: {
          type: Type.STRING,
          description: 'Updated shift clock-in time (HH:mm).',
        },
        clockOut: {
          type: Type.STRING,
          description: 'Updated shift clock-out time (HH:mm).',
        },
        visits: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              branch: {
                type: Type.STRING,
                description: '24-character hexadecimal MongoDB ObjectId of the visited branch.',
              },
              clockIn: {
                type: Type.STRING,
                description: 'Branch arrival time formatted strictly as HH:mm.',
              },
              clockOut: {
                type: Type.STRING,
                description: 'Branch departure time formatted strictly as HH:mm.',
              },
            },
            required: ['branch', 'clockIn', 'clockOut'],
          },
          description: 'Updated chronological list of physical branch visits.',
        },
        newActivities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: 'Activity description.' },
              status: { type: Type.STRING, description: "Activity status: 'in_progress' or 'completed'." },
            },
            required: ['text'],
          },
          description: 'New activities to append to the report.',
        },
        newIssues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: 'Issue description.' },
              status: {
                type: Type.STRING,
                description: "Issue status: 'reported', 'completed', 'in_progress', or 'no_issue'.",
              },
            },
            required: ['text'],
          },
          description: 'New issues to append to the report.',
        },
        newComments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: 'Comment text.' },
            },
            required: ['text'],
          },
          description: 'New comments to append to the report.',
        },
        customSections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING, description: 'Section title.' },
              items: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Items list.' },
            },
            required: ['heading', 'items'],
          },
          description: 'Updated custom report sections.',
        },
        transcription: {
          type: Type.STRING,
          description: 'Updated formatted Amharic corporate transcription text.',
        },
      },
    },
  },
  {
    name: 'update_branch_record_status',
    description:
      'Update the status or resolution notes of a specific branch issue or activity subdocument directly from chat.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description: '24-hex ObjectId of the report containing the record.',
        },
        recordId: {
          type: Type.STRING,
          description: '24-hex ObjectId of the specific subdocument (issue or activity).',
        },
        recordType: {
          type: Type.STRING,
          description: "Subdocument type: 'issue' or 'activity'.",
        },
        newStatus: {
          type: Type.STRING,
          description: "New status value: 'reported', 'completed', 'in_progress', or 'no_issue'.",
        },
        resolutionNotes: {
          type: Type.STRING,
          description: 'Optional corrective notes describing how the item was addressed.',
        },
      },
      required: ['reportId', 'recordId', 'recordType', 'newStatus'],
    },
  },
  {
    name: 'archive_report',
    description:
      'Soft-archive an operational report (sets isArchived: true, archivedAt: new Date()), entering the 30-day sweeper retention window.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description: '24-hex ObjectId of the report to archive.',
        },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'restore_report',
    description:
      'Restore a previously archived report back to active status prior to 30-day sweeper purge.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description: '24-hex ObjectId of the archived report to restore.',
        },
      },
      required: ['reportId'],
    },
  },
  {
    name: 'delete_report_permanently',
    description:
      'Permanently hard-delete an archived report from MongoDB and unlink associated Audio binary files strictly post-commit.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description: '24-hex ObjectId of the archived report to permanently delete.',
        },
      },
      required: ['reportId'],
    },
  },

  // ==========================================
  // CATEGORY 3: ENTERPRISE INTELLIGENCE & CROSS-BRANCH QUERIES (2 TOOLS)
  // ==========================================
  {
    name: 'query_historical_reports',
    description:
      'Search and retrieve previously generated operational reports across one, several, or all branches and date ranges from MongoDB. Supports status filtering (active, archived, or all) and keyword search.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Optional array of branch ObjectIds or codes (e.g. ["BOLE-01", "PIAS-01"]). If omitted, queries across all branches.',
        },
        branchId: {
          type: Type.STRING,
          description: 'Optional single branch ObjectId or code (for backwards compatibility).',
        },
        date: {
          type: Type.STRING,
          description: 'Optional single ISO date string (YYYY-MM-DD).',
        },
        startDate: {
          type: Type.STRING,
          description: 'Optional ISO date string for historical start range (YYYY-MM-DD).',
        },
        endDate: {
          type: Type.STRING,
          description: 'Optional ISO date string for historical end range (YYYY-MM-DD).',
        },
        status: {
          type: Type.STRING,
          description: "Status filter: 'active' (default), 'archived', or 'all'.",
        },
        keyword: {
          type: Type.STRING,
          description: 'Optional text keyword to search within report transcription.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum number of historical reports to return (1 to 20, default: 5).',
        },
      },
    },
  },
  {
    name: 'query_branch_records',
    description:
      'Granular subdocument query across historical operational reports for issues, activities, visits, or comments across one, several, or all branches, filtered by status, dates, and keywords.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Optional array of branch ObjectIds or codes (e.g. ["BOLE-01", "PIAS-01"]). If omitted, queries across all branches.',
        },
        branchId: {
          type: Type.STRING,
          description: 'Optional single branch ObjectId or code (for backwards compatibility).',
        },
        date: {
          type: Type.STRING,
          description: 'Optional single ISO date string (YYYY-MM-DD).',
        },
        startDate: {
          type: Type.STRING,
          description: 'Optional ISO start date (YYYY-MM-DD).',
        },
        endDate: {
          type: Type.STRING,
          description: 'Optional ISO end date (YYYY-MM-DD).',
        },
        recordType: {
          type: Type.STRING,
          description: "Type of records: 'all', 'issues', 'activities', 'visits', or 'comments' (default: 'all').",
        },
        status: {
          type: Type.STRING,
          description:
            "Filter status: 'all', 'reported', 'completed', 'in_progress', or 'no_issue' (default: 'all').",
        },
        keyword: {
          type: Type.STRING,
          description: 'Optional keyword to search within record texts.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum matching items to return (1 to 50, default: 15).',
        },
      },
    },
  },

  // ==========================================
  // CATEGORY 4: CLOUD WORKSPACE, DOCUMENT GENERATION & BROADCAST (4 TOOLS)
  // ==========================================
  {
    name: 'manage_google_drive',
    description:
      'Autonomously manage Google Drive folders, files, searches, metadata, and sharing permissions. Can list files in a folder, create folders, search files by keyword, inspect file metadata, or share documents with collaborators.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "Operation to perform: 'list', 'create_folder', 'search', 'get_metadata', or 'share'.",
        },
        folderName: {
          type: Type.STRING,
          description: 'Name of the folder to create (required when action is create_folder).',
        },
        query: {
          type: Type.STRING,
          description: 'Search keyword to filter files/folders (used when action is search).',
        },
        folderId: {
          type: Type.STRING,
          description: 'Optional Google Drive folder ID to scope operations inside (defaults to "Personal AI Agent" root).',
        },
        fileId: {
          type: Type.STRING,
          description: 'Google Drive file or folder ID (required for get_metadata and share).',
        },
        role: {
          type: Type.STRING,
          description: "Permission role when sharing: 'reader', 'commenter', or 'writer'. Default: 'reader'.",
        },
        emailAddress: {
          type: Type.STRING,
          description: 'Optional email address of collaborator to share with. Omit to share publicly via link.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'create_cloud_document',
    description:
      'Autonomously create and format a live Google Doc or Google Spreadsheet in Google Drive. For documents, provide open-ended text or markdown in content. For spreadsheets, provide arbitrary structured data, table arrays, or cell grids in data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Document type to create: 'doc' (Google Document) or 'sheet' (Google Spreadsheet). Default: 'doc'.",
        },
        title: {
          type: Type.STRING,
          description: 'Title of the Google Document or Spreadsheet.',
        },
        folderId: {
          type: Type.STRING,
          description: 'Optional Google Drive folder ID to place the file into (defaults to "Personal AI Agent" root).',
        },
        content: {
          type: Type.STRING,
          description: 'Open-ended markdown or text content to format and insert into the Google Doc.',
        },
        data: {
          type: Type.OBJECT,
          description: 'Arbitrary structured data, table rows, cell grid, or key-value map to populate into the Google Sheet.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'generate_document_file',
    description:
      'Generate an open-ended document file in PDF, Microsoft Word (.docx), Microsoft Excel (.xlsx), CSV, Markdown, or JSON. Can deliver either as a direct browser download URL or upload immediately to Google Drive.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        format: {
          type: Type.STRING,
          description: "File format: 'pdf', 'docx', 'xlsx', 'csv', 'markdown', or 'json'. Default: 'pdf'.",
        },
        title: {
          type: Type.STRING,
          description: 'Document title and output filename.',
        },
        destination: {
          type: Type.STRING,
          description: "Destination for generated document: 'download' (local download URL) or 'google_drive' (upload to Google Drive). Default: 'download'.",
        },
        folderId: {
          type: Type.STRING,
          description: 'Optional Google Drive folder ID when destination is google_drive.',
        },
        content: {
          type: Type.STRING,
          description: 'Open-ended text, markdown, report summary, letter, notes, or paragraphs for the document.',
        },
        data: {
          type: Type.OBJECT,
          description: 'Arbitrary structured data, tabular rows, list of records, or object grid for spreadsheets, tables, or JSON.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'share_to_telegram',
    description:
      'Format and dispatch any message, team announcement, operational report, executive summary, or urgent incident briefing to designated Telegram channels or groups (management, maintenance, general). Operates universally across all interaction quadrants with high-fidelity formatting and functional stubbing without requiring a reportId.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: {
          type: Type.STRING,
          description: 'Optional 24-character hexadecimal MongoDB ObjectId of the report to broadcast.',
        },
        messageText: {
          type: Type.STRING,
          description: 'Custom message text, team announcement, briefing summary, or urgent incident note to broadcast.',
        },
        targetChannel: {
          type: Type.STRING,
          description: "Target channel: 'management' (default), 'maintenance', or 'general'.",
        },
        customNote: {
          type: Type.STRING,
          description: 'Optional supervisor header remark or delivery note.',
        },
        asImage: {
          type: Type.BOOLEAN,
          description: 'Optional flag to render and broadcast the report or message as a high-contrast document image card.',
        },
        fontSize: {
          type: Type.STRING,
          description: 'Optional font size specification (e.g. "14pt", "14 in ms word", "38px", "40px", "small", "medium", "large").',
        },
        lineSpacing: {
          type: Type.STRING,
          description: 'Optional line spacing ("compact", "normal", "relaxed", or pixel value like "40px").',
        },
        bulletIndent: {
          type: Type.STRING,
          description: 'Optional bullet indentation specification (e.g. "more", "less", "large", "compact", "48px", "60px", "80px").',
        },
        paddingX: {
          type: Type.STRING,
          description: 'Optional horizontal padding / side margins (e.g. "compact", "wide", "50px", "100px").',
        },
        bold: {
          type: Type.BOOLEAN,
          description: 'Optional flag to render all content in bold weight.',
        },
        underlineHeaders: {
          type: Type.BOOLEAN,
          description: 'Optional flag to render section headers with underline decoration.',
        },
        theme: {
          type: Type.STRING,
          description: 'Optional color theme: "light" (default white paper) or "dark".',
        },
        fontFamily: {
          type: Type.STRING,
          description: 'Optional font family for rendering (e.g. "Segoe UI, Arial, sans-serif", "Georgia, serif").',
        },
        textColor: {
          type: Type.STRING,
          description: 'Optional font color hex (e.g. "#000000", "#1E293B", "#1E40AF").',
        },
        bgColor: {
          type: Type.STRING,
          description: 'Optional card background color / shading hex (e.g. "#FFFFFF", "#F8FAFC", "#1E1E1E").',
        },
        align: {
          type: Type.STRING,
          description: 'Optional text alignment: "left" (default), "center", or "right".',
        },
        border: {
          type: Type.BOOLEAN,
          description: 'Optional card border outline flag.',
        },
        letterSpacing: {
          type: Type.NUMBER,
          description: 'Optional character spacing in pixels (e.g. 1, 2).',
        },
        saveAsDefault: {
          type: Type.BOOLEAN,
          description: 'Optional flag to save these layout and formatting preferences permanently into supervisor settings for future posts.',
        },
      },
    },
  },
  {
    name: 'save_user_directive',
    description:
      'Persist vocabulary rules, preferred terms, phrase replacements, or custom personal/operational instructions to User.settings.directives (Single Source of Truth) in MongoDB inside an ACID transaction.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        negativeVocabularyToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Words or terms to strictly ban and exclude from generated reports and outputs.',
        },
        negativeVocabularyToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Forbidden words to unban and remove from negative vocabulary.',
        },
        phraseMappingsToAdd: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Shorthand or colloquial term.' },
              value: { type: Type.STRING, description: 'Authoritative replacement term.' },
            },
            required: ['key', 'value'],
          },
          description: 'Key-value replacement mappings to add or update.',
        },
        phraseMappingsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Keys of phrase mappings to remove.',
        },
        customInstructionsToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational or personal directives, style guidelines, or rules to add to user settings.',
        },
        customInstructionsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational or personal directives to remove.',
        },
        singleBranchTemplate: {
          type: Type.STRING,
          description:
            'Optional custom Amharic corporate template text for Single-Branch reports (persisted to User.settings.reportTemplates.singleBranch; pass empty string or null to reset to default).',
        },
        multiBranchTemplate: {
          type: Type.STRING,
          description:
            'Optional custom Amharic corporate template text for Multi-Branch reports (persisted to User.settings.reportTemplates.multiBranch; pass empty string or null to reset to default).',
        },
      },
    },
  },
  {
    name: 'save_supervisor_directive',
    description:
      'Backwards-compatible alias for save_user_directive. Persist vocabulary rules, forbidden words, phrase replacements, or custom instructions to User.settings.directives.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        negativeVocabularyToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Words or terms to strictly ban and exclude from generated reports.',
        },
        negativeVocabularyToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Forbidden words to unban and remove from negative vocabulary.',
        },
        phraseMappingsToAdd: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Shorthand or colloquial term.' },
              value: { type: Type.STRING, description: 'Authoritative corporate replacement term.' },
            },
            required: ['key', 'value'],
          },
          description: 'Key-value replacement mappings to add or update.',
        },
        phraseMappingsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Keys of phrase mappings to remove.',
        },
        customInstructionsToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational directives or rules to add to the supervisor profile.',
        },
        customInstructionsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational directives or rules to remove.',
        },
        singleBranchTemplate: {
          type: Type.STRING,
          description:
            'Optional custom Amharic corporate template text for Single-Branch reports (persisted to User.settings.reportTemplates.singleBranch; pass empty string or null to reset to default).',
        },
        multiBranchTemplate: {
          type: Type.STRING,
          description:
            'Optional custom Amharic corporate template text for Multi-Branch reports (persisted to User.settings.reportTemplates.multiBranch; pass empty string or null to reset to default).',
        },
      },
    },
  },
  {
    name: 'get_user_settings',
    description:
      'Retrieve current user configuration, STT engine, report templates, or directives from MongoDB inside an ACID transaction or read path.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          description:
            "Specific section to inspect: 'all' (default), 'directives', 'agentConfig', 'reportTemplates', or 'sttEngine'.",
        },
      },
    },
  },
  {
    name: 'update_user_settings',
    description:
      'Persist updates to User.settings (directives, agentConfig, sttEngine, reportTemplates) in MongoDB inside an ACID transaction.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        negativeVocabularyToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Words or terms to strictly ban and exclude from generated reports or responses.',
        },
        negativeVocabularyToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Forbidden words to unban and remove from negative vocabulary.',
        },
        phraseMappingsToAdd: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Shorthand or colloquial term to replace.' },
              value: { type: Type.STRING, description: 'Authoritative corporate or preferred replacement term.' },
            },
            required: ['key', 'value'],
          },
          description: 'Array of key-value replacement mappings to add or update.',
        },
        phraseMappingsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Keys of phrase mappings to remove.',
        },
        customInstructionsToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational or personal rules/instructions to add to user profile.',
        },
        customInstructionsToRemove: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Discrete operational or personal rules/instructions to remove.',
        },
        clearDirectives: {
          type: Type.BOOLEAN,
          description: 'Set to true to clear all negative vocabulary, phrase mappings, and custom instructions.',
        },
        persona: {
          type: Type.STRING,
          description: 'Update the user AI operational/personal persona lens.',
        },
        defaultModel: {
          type: Type.STRING,
          description: `Update default AI model: ${AI_MODELS.SUPPORTED.join(', ')}.`,
        },
        defaultThinkingBudget: {
          type: Type.INTEGER,
          description: 'Update default reasoning budget (0 to 8192 tokens).',
        },
        defaultLanguage: {
          type: Type.STRING,
          description: "Update default working language: 'am', 'en', or 'auto'.",
        },
        resetAgentConfig: {
          type: Type.BOOLEAN,
          description: 'Set to true to reset agentConfig (persona, model, budget, language) to system factory defaults.',
        },
        sttEngine: {
          type: Type.STRING,
          description: `Update speech-to-text engine: ${AI_MODELS.STT_ENGINES.join(', ')}.`,
        },
        singleBranchTemplate: {
          type: Type.STRING,
          description: 'Custom Single-Branch Amharic template text.',
        },
        multiBranchTemplate: {
          type: Type.STRING,
          description: 'Custom Multi-Branch Amharic template text.',
        },
        resetSingleBranchTemplate: {
          type: Type.BOOLEAN,
          description: 'Reset single branch report template to system default.',
        },
        resetMultiBranchTemplate: {
          type: Type.BOOLEAN,
          description: 'Reset multi-branch report template to system default.',
        },
        googleDriveEnabled: {
          type: Type.BOOLEAN,
          description: 'Enable or disable Google Drive integration without disconnecting.',
        },
      },
    },
  },
];

/**
 * ==============================================================================
 * 2. In-Process Tool Execution Handlers (17 In-Memory ACID Handlers)
 * ==============================================================================
 */
export const toolHandlers = {
  // ----------------------------------------------------------------------------
  // Category 1: Branch Scope Handlers
  // ----------------------------------------------------------------------------

  /**
   * 1. lookup_user_branches
   */
  lookup_user_branches: async ({ args = {}, userId }) => {
    const status = args.status || 'active';
    const query = { user: userId };

    if (status === 'active') {
      query.isArchived = false;
    } else if (status === 'archived') {
      query.isArchived = true;
    }

    if (args.search && typeof args.search === 'string' && args.search.trim()) {
      const searchTerms = getBilingualSearchTerms(args.search.trim());
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

    const branches = await Branch.find(query)
      .select('_id name code location managerName contactPhone isArchived archivedAt')
      .sort({ name: 1 })
      .lean();

    return {
      branches: branches.map((b) => ({
        _id: b._id.toString(),
        name: b.name,
        code: b.code,
        location: b.location?.address || b.location?.city || null,
        address: b.location?.address || null,
        phone: b.contactPhone || null,
        managerName: b.managerName || null,
        isArchived: b.isArchived,
      })),
      count: branches.length,
    };
  },

  /**
   * 2. create_branch
   */
  create_branch: async ({ args = {}, userId, session = null }) => {
    const { name, address, phone, managerName } = args;
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      throw new ValidationError('Branch name is required.');
    }

    return await runInTransaction(session, async (activeSession) => {
      // 1. Collision check for active branch name
      const nameRegex = new RegExp(`^${escapeRegex(cleanName)}$`, 'i');
      const existingByName = await Branch.findOne({
        user: userId,
        name: nameRegex,
        isArchived: false,
      }).session(activeSession);

      if (existingByName) {
        throw new ConflictError('A branch with this name already exists.');
      }

      // 2. Auto-generate operational code
      const existingBranches = await Branch.find({ user: userId })
        .select('code')
        .session(activeSession)
        .lean();
      const existingCodes = existingBranches.map((b) => b.code);
      const branchCode = generateBranchCode(cleanName, existingCodes);

      // 3. Resolve bilingual aliases
      const aliases = resolveBranchAliases(cleanName);

      // 4. Create branch document
      const [newBranch] = await Branch.create(
        [
          {
            user: userId,
            name: cleanName,
            code: branchCode,
            aliases,
            location: {
              city: BRANCH_CONSTANTS.DEFAULT_CITY,
              address: (address || '').trim(),
            },
            managerName: (managerName || '').trim(),
            contactPhone: (phone || '').trim(),
            isArchived: false,
          },
        ],
        { session: activeSession }
      );

      return {
        branchId: newBranch._id.toString(),
        name: newBranch.name,
        code: newBranch.code,
        address: newBranch.location?.address || '',
        phone: newBranch.contactPhone,
        managerName: newBranch.managerName,
        message: 'Branch created successfully.',
      };
    });
  },

  /**
   * 3. update_branch
   */
  update_branch: async ({ args = {}, userId, session = null }) => {
    const { branchId, name, address, phone, managerName } = args;

    if (!branchId) {
      throw new ValidationError('Branch identifier is required.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const query = {
        ...buildBranchIdentifierQuery(branchId, userId),
        isArchived: false,
      };
      const branch = await Branch.findOne(query).session(activeSession);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }

      // If name updated, verify collision
      if (name && name.trim() !== branch.name) {
        const cleanName = name.trim();
        const nameRegex = new RegExp(`^${escapeRegex(cleanName)}$`, 'i');
        const collidingName = await Branch.findOne({
          _id: { $ne: branch._id },
          user: userId,
          name: nameRegex,
          isArchived: false,
        }).session(activeSession);

        if (collidingName) {
          throw new ConflictError('A branch with this name already exists.');
        }

        branch.name = cleanName;
        branch.aliases = resolveBranchAliases(cleanName);
      }

      if (address !== undefined) {
        if (!branch.location) branch.location = {};
        branch.location.address = String(address).trim();
      }
      if (phone !== undefined) {
        branch.contactPhone = String(phone).trim();
      }
      if (managerName !== undefined) {
        branch.managerName = String(managerName).trim();
      }

      await branch.save({ session: activeSession });

      return {
        branchId: branch._id.toString(),
        name: branch.name,
        code: branch.code,
        address: branch.location?.address || '',
        phone: branch.contactPhone,
        managerName: branch.managerName,
        message: 'Branch updated successfully.',
      };
    });
  },

  /**
   * 4. archive_branch
   */
  archive_branch: async ({ args = {}, userId, session = null }) => {
    const { branchId } = args;
    if (!branchId) {
      throw new ValidationError('Branch identifier is required.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const query = buildBranchIdentifierQuery(branchId, userId);
      const branch = await Branch.findOne(query).session(activeSession);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }
      if (branch.isArchived) {
        throw new BadRequestError('Branch is already archived.');
      }

      branch.isArchived = true;
      branch.archivedAt = new Date();
      await branch.save({ session: activeSession });

      return {
        branchId: branch._id.toString(),
        name: branch.name,
        code: branch.code,
        isArchived: true,
        archivedAt: branch.archivedAt,
        message: 'Branch archived successfully.',
      };
    });
  },

  /**
   * 5. restore_branch
   */
  restore_branch: async ({ args = {}, userId, session = null }) => {
    const { branchId } = args;
    if (!branchId) {
      throw new ValidationError('Branch identifier is required.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const query = buildBranchIdentifierQuery(branchId, userId);
      const branch = await Branch.findOne(query).session(activeSession);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }
      if (!branch.isArchived) {
        throw new BadRequestError('Branch is already active and cannot be restored.');
      }

      // Name collision check
      const nameRegex = new RegExp(`^${escapeRegex(branch.name)}$`, 'i');
      const collidingName = await Branch.findOne({
        _id: { $ne: branch._id },
        user: userId,
        name: nameRegex,
        isArchived: false,
      }).session(activeSession);

      if (collidingName) {
        throw new ConflictError(
          'An active branch with this name already exists. Please resolve the collision before restoring.'
        );
      }

      // Code collision check
      const collidingCode = await Branch.findOne({
        _id: { $ne: branch._id },
        user: userId,
        code: branch.code,
        isArchived: false,
      }).session(activeSession);

      if (collidingCode) {
        throw new ConflictError(
          'An active branch with this operational code already exists. Please resolve the collision before restoring.'
        );
      }

      branch.isArchived = false;
      branch.archivedAt = null;
      await branch.save({ session: activeSession });

      return {
        branchId: branch._id.toString(),
        name: branch.name,
        code: branch.code,
        isArchived: false,
        message: 'Branch restored successfully.',
      };
    });
  },

  /**
   * 6. delete_branch_permanently
   */
  delete_branch_permanently: async ({ args = {}, userId, session = null }) => {
    const { branchId } = args;
    if (!branchId) {
      throw new ValidationError('Branch identifier is required.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const query = buildBranchIdentifierQuery(branchId, userId);
      const branch = await Branch.findOne(query).session(activeSession);

      if (!branch) {
        throw new NotFoundError('Branch not found.');
      }
      if (!branch.isArchived) {
        throw new BadRequestError(
          'Only archived branches can be permanently deleted. Please archive the branch first.'
        );
      }

      await cascadeDeleteBranch(branch._id, activeSession);

      return {
        branchId: branch._id.toString(),
        message: 'Branch permanently deleted successfully.',
      };
    });
  },

  // ----------------------------------------------------------------------------
  // Category 2: Report Scope Handlers
  // ----------------------------------------------------------------------------

  /**
   * 7. create_report
   */
  create_report: async ({ args, userId, session = null }) => {
    const normalizedArgs = { ...args };

    // Normalize date: support ISO strings or Ethiopian date strings (DD-MM-YY, DD/MM/YYYY, etc.)
    if (normalizedArgs.date && typeof normalizedArgs.date === 'string') {
      const ethMatch = normalizedArgs.date.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
      if (ethMatch) {
        const day = parseInt(ethMatch[1], 10);
        const month = parseInt(ethMatch[2], 10);
        let year = parseInt(ethMatch[3], 10);
        if (year < 100) year += 2000;
        if (year >= 2000 && year <= 2100 && month >= 1 && month <= 13 && day >= 1 && day <= 30) {
          const gregDate = toGregorianDate(year, month, day);
          normalizedArgs.date = gregDate.toISOString().split('T')[0];
        }
      } else {
        const candidate = new Date(normalizedArgs.date);
        const now = new Date();
        const maxAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (!isNaN(candidate.getTime()) && candidate > maxAllowed) {
          const candDay = candidate.getUTCDate();
          const prevMonthDate = new Date(candidate);
          prevMonthDate.setUTCMonth(candidate.getUTCMonth() - 1);
          if (prevMonthDate <= maxAllowed && prevMonthDate.getUTCDate() === candDay) {
            normalizedArgs.date = prevMonthDate.toISOString().split('T')[0];
          } else {
            normalizedArgs.date = now.toISOString().split('T')[0];
          }
        }
      }
    }

    // Resolve branch identifiers if passed as codes or names
    if (Array.isArray(normalizedArgs.visits)) {
      normalizedArgs.visits = await Promise.all(
        normalizedArgs.visits.map(async (v) => {
          let branchId = v.branch || v.branchId;
          if (branchId) {
            const resolved = await resolveBranchObjectIds([branchId], userId, session);
            if (resolved.length > 0) {
              branchId = resolved[0].toString();
            } else if (isValidObjectId(String(branchId))) {
              const exists = await Branch.findOne({ _id: branchId, user: userId })
                .session(session || null)
                .lean();
              if (!exists) {
                throw new ValidationError(
                  `Branch identifier "${branchId}" does not exist in your registered branches. Please invoke create_branch to register it first.`
                );
              }
            } else {
              throw new ValidationError(
                `Branch "${branchId}" is not registered in your active branches. Please invoke create_branch to register it first or ask the supervisor to clarify.`
              );
            }
          }
          return {
            ...v,
            branch: branchId,
            clockIn: (v.clockIn || normalizedArgs.clockIn || '08:00').trim(),
            clockOut: (v.clockOut || normalizedArgs.clockOut || '17:00').trim(),
          };
        })
      );
    }

    // Normalize activities to { text, status }
    if (Array.isArray(normalizedArgs.activities)) {
      normalizedArgs.activities = normalizedArgs.activities.map((a) =>
        typeof a === 'string'
          ? { text: a.trim(), status: 'completed' }
          : { text: (a.text || a.description || '').trim(), status: normalizeActivityStatus(a.status) }
      );
    }

    // Normalize issues to { text, status }
    if (Array.isArray(normalizedArgs.issues)) {
      normalizedArgs.issues = normalizedArgs.issues.map((i) =>
        typeof i === 'string'
          ? { text: i.trim(), status: 'reported' }
          : { text: (i.text || i.description || '').trim(), status: normalizeIssueStatus(i.status) }
      );
    }

    // Normalize comments to { text }
    if (Array.isArray(normalizedArgs.comments)) {
      normalizedArgs.comments = normalizedArgs.comments.map((c) =>
        typeof c === 'string'
          ? { text: c.trim() }
          : { text: (c.text || c.content || c.comment || '').trim() }
      );
    } else {
      normalizedArgs.comments = [];
    }

    if (!Array.isArray(normalizedArgs.activities)) {
      normalizedArgs.activities = [];
    }

    if (!Array.isArray(normalizedArgs.issues)) {
      normalizedArgs.issues = [];
    }

    // Normalize customSections to { heading, items }
    if (Array.isArray(normalizedArgs.customSections)) {
      normalizedArgs.customSections = normalizedArgs.customSections
        .map((cs) => ({
          heading: String(cs.heading || '').trim(),
          items: Array.isArray(cs.items)
            ? cs.items.map((it) => String(it).trim()).filter(Boolean)
            : [],
        }))
        .filter((cs) => cs.heading);
    } else {
      normalizedArgs.customSections = [];
    }

    // Default transcription text if empty
    if (!normalizedArgs.transcription || typeof normalizedArgs.transcription !== 'string' || !normalizedArgs.transcription.trim()) {
      normalizedArgs.transcription = 'ዕለታዊ የስራ እንቅስቃሴ ሪፖርት';
    }

    try {
      const validatedPayload = validateReportPayload(normalizedArgs);
      const createdReport = await createReportRecord({
        userId,
        payload: validatedPayload,
        existingSession: session,
      });

      return {
        success: true,
        reportId: createdReport._id.toString(),
        date: createdReport.date,
        dateString: createdReport.dateString,
        ethiopianDate: createdReport.ethiopianDate,
        visitsCount: createdReport.visits.length,
        activitiesCount: createdReport.activities.length,
        issuesCount: createdReport.issues.length,
        commentsCount: createdReport.comments.length,
        transcription: createdReport.transcription,
        message: 'Operational report successfully created and persisted.',
      };
    } catch (err) {
      if (err.code === 'REPORT_ALREADY_EXISTS' || err.code === 11000) {
        const targetDate = new Date(normalizedArgs.date);
        const targetDateString = targetDate.toISOString().split('T')[0];
        const targetEthDate = toEthiopianDateString(targetDate);

        const existing = await Report.findOne({
          user: userId,
          isArchived: false,
          $or: [
            { dateString: targetDateString },
            { ethiopianDate: targetEthDate },
          ],
        })
          .populate('visits.branch', 'name code')
          .session(session || null);

        if (existing) {
          const visitSummary = (existing.visits || [])
            .map((v) => `${v.branch?.name || v.branch?.code || v.branch} (${v.clockIn}-${v.clockOut})`)
            .join(', ');

          return {
            success: false,
            code: 'REPORT_ALREADY_EXISTS',
            message: `A report already exists for ${targetDateString} (Ethiopian: ${existing.ethiopianDate}) with Report ID: "${existing._id}". A supervisor may only have one operational report per calendar day.`,
            existingReport: {
              reportId: existing._id.toString(),
              dateString: existing.dateString,
              ethiopianDate: existing.ethiopianDate,
              clockIn: existing.clockIn,
              clockOut: existing.clockOut,
              visits: visitSummary,
              activitiesCount: (existing.activities || []).length,
              issuesCount: (existing.issues || []).length,
              commentsCount: (existing.comments || []).length,
            },
            guidance: `If the supervisor intends to amend, add new activities, or update branch visits for this date, invoke "update_report" with reportId: "${existing._id}". If the user is asking to create a separate report or is unsure, ask the supervisor in chat how they would like to proceed.`,
          };
        }
      }
      throw err;
    }
  },

  /**
   * 8. update_report
   */
  update_report: async ({ args = {}, userId, session = null }) => {
    const { reportId, date, clockIn, clockOut, visits, transcription } = args;
    const activitiesToAppend = args.newActivities || args.appendActivities || [];
    const issuesToAppend = args.newIssues || args.appendIssues || [];
    const commentsToAppend = args.newComments || args.appendComments || [];

    return await runInTransaction(session, async (activeSession) => {
      let report = null;

      if (reportId && isValidObjectId(reportId)) {
        report = await Report.findOne({ _id: reportId, user: userId, isArchived: false }).session(
          activeSession
        );
      }

      if (!report) {
        // Resolve target report by date, or default to current system date
        let queryDate = new Date();
        if (date && typeof date === 'string') {
          const ethMatch = date.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
          if (ethMatch) {
            const day = parseInt(ethMatch[1], 10);
            const month = parseInt(ethMatch[2], 10);
            let year = parseInt(ethMatch[3], 10);
            if (year < 100) year += 2000;
            if (year >= 2000 && year <= 2100 && month >= 1 && month <= 13 && day >= 1 && day <= 30) {
              queryDate = toGregorianDate(year, month, day);
            }
          } else {
            const parsed = new Date(date);
            if (!isNaN(parsed.getTime())) queryDate = parsed;
          }
        }

        const dateStr = queryDate.toISOString().split('T')[0];
        const ethStr = toEthiopianDateString(queryDate);

        report = await Report.findOne({
          user: userId,
          isArchived: false,
          $or: [{ dateString: dateStr }, { ethiopianDate: ethStr }],
        }).session(activeSession);

        if (!report) {
          throw new NotFoundError(
            `No active operational report found for date ${dateStr} (Ethiopian: ${ethStr}). If creating a new shift report, invoke create_report.`
          );
        }
      }

      if (date !== undefined) {
        report.date = new Date(date);
        report.dateString = report.date.toISOString().split('T')[0];
        report.ethiopianDate = toEthiopianDateString(report.date);
      }
      if (clockIn !== undefined) report.clockIn = clockIn;
      if (clockOut !== undefined) report.clockOut = clockOut;
      if (transcription !== undefined) report.transcription = transcription;

      if (Array.isArray(visits) && visits.length > 0) {
        const branchIdsToVerify = visits.map((v) => String(v.branch)).filter(Boolean);
        const uniqueIds = [...new Set(branchIdsToVerify)];
        const branches = await Branch.find({
          _id: { $in: uniqueIds },
          user: userId,
          isArchived: false,
        }).session(activeSession);

        if (branches.length !== uniqueIds.length) {
          throw new NotFoundError(
            'One or more updated branches could not be found or do not belong to your account.'
          );
        }
        report.visits = visits;
      }

      if (Array.isArray(activitiesToAppend) && activitiesToAppend.length > 0) {
        for (const act of activitiesToAppend) {
          const actText = typeof act === 'string' ? act.trim() : act?.text?.trim();
          if (actText) {
            report.activities.push({
              text: actText,
              status: normalizeActivityStatus(typeof act === 'object' ? act?.status : undefined),
            });
          }
        }
      }

      if (Array.isArray(issuesToAppend) && issuesToAppend.length > 0) {
        for (const iss of issuesToAppend) {
          const issText = typeof iss === 'string' ? iss.trim() : iss?.text?.trim();
          if (issText) {
            report.issues.push({
              text: issText,
              status: normalizeIssueStatus(typeof iss === 'object' ? iss?.status : undefined),
            });
          }
        }
      }

      if (Array.isArray(commentsToAppend) && commentsToAppend.length > 0) {
        for (const com of commentsToAppend) {
          const comText = typeof com === 'string' ? com.trim() : com?.text?.trim();
          if (comText) {
            report.comments.push({ text: comText });
          }
        }
      }

      if (Array.isArray(args.customSections)) {
        report.customSections = args.customSections
          .map((cs) => ({
            heading: String(cs.heading || '').trim(),
            items: Array.isArray(cs.items) ? cs.items.map((it) => String(it).trim()).filter(Boolean) : [],
          }))
          .filter((cs) => cs.heading);
      }

      await report.save({ session: activeSession });

      return {
        success: true,
        reportId: report._id.toString(),
        clockIn: report.clockIn,
        clockOut: report.clockOut,
        activitiesCount: report.activities.length,
        issuesCount: report.issues.length,
        commentsCount: report.comments.length,
        transcription: report.transcription,
        message: 'Report updated successfully.',
      };
    });
  },

  /**
   * 9. update_branch_record_status
   */
  update_branch_record_status: async ({ args = {}, userId, session = null }) => {
    const { reportId, recordType, newStatus, resolutionNotes } = args;
    const targetItemId = args.recordId || args.itemId;

    if (!isValidObjectId(reportId)) {
      throw new ValidationError('Invalid report ID.');
    }
    if (!isValidObjectId(targetItemId)) {
      throw new ValidationError('Invalid item/record ID.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const report = await Report.findOne({ _id: reportId, user: userId, isArchived: false }).session(
        activeSession
      );
      if (!report) {
        throw new NotFoundError('Report not found.');
      }

      let updatedItem = null;

      if (recordType === 'issue') {
        const canonicalStatus = normalizeIssueStatus(newStatus);
        if (!REPORT_CONSTANTS.ISSUE_STATUSES.includes(canonicalStatus)) {
          throw new ValidationError(
            `Invalid issue status. Must be one of: ${REPORT_CONSTANTS.ISSUE_STATUSES.join(', ')}`
          );
        }
        const item = report.issues.id(targetItemId);
        if (!item) {
          throw new NotFoundError('Issue item not found in report.');
        }
        item.status = canonicalStatus;
        if (resolutionNotes && typeof resolutionNotes === 'string' && resolutionNotes.trim()) {
          item.text = `${item.text} (Resolution: ${resolutionNotes.trim()})`;
        }
        updatedItem = item;
      } else if (recordType === 'activity') {
        const canonicalStatus = normalizeActivityStatus(newStatus);
        if (!REPORT_CONSTANTS.ACTIVITY_STATUSES.includes(canonicalStatus)) {
          throw new ValidationError(
            `Invalid activity status. Must be one of: ${REPORT_CONSTANTS.ACTIVITY_STATUSES.join(', ')}`
          );
        }
        const item = report.activities.id(targetItemId);
        if (!item) {
          throw new NotFoundError('Activity item not found in report.');
        }
        item.status = canonicalStatus;
        updatedItem = item;
      } else {
        throw new ValidationError('recordType must be "issue" or "activity".');
      }

      await report.save({ session: activeSession });

      return {
        reportId,
        recordType,
        recordId: targetItemId,
        itemId: targetItemId,
        newStatus,
        updatedItem: {
          _id: updatedItem._id.toString(),
          text: updatedItem.text,
          status: updatedItem.status,
        },
        message: `Record status successfully updated to "${newStatus}".`,
      };
    });
  },

  /**
   * 10. archive_report
   */
  archive_report: async ({ args = {}, userId, session = null }) => {
    const { reportId } = args;
    if (!isValidObjectId(reportId)) {
      throw new ValidationError('Invalid report ID.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const report = await Report.findOne({ _id: reportId, user: userId }).session(activeSession);
      if (!report) {
        throw new NotFoundError('Report not found.');
      }
      if (report.isArchived) {
        throw new BadRequestError('Report is already archived.');
      }

      report.isArchived = true;
      report.archivedAt = new Date();
      await report.save({ session: activeSession });

      return {
        reportId: report._id.toString(),
        isArchived: true,
        archivedAt: report.archivedAt,
        message: 'Report archived successfully.',
      };
    });
  },

  /**
   * 11. restore_report
   */
  restore_report: async ({ args = {}, userId, session = null }) => {
    const { reportId } = args;
    if (!isValidObjectId(reportId)) {
      throw new ValidationError('Invalid report ID.');
    }

    return await runInTransaction(session, async (activeSession) => {
      const report = await Report.findOne({ _id: reportId, user: userId }).session(activeSession);
      if (!report) {
        throw new NotFoundError('Report not found.');
      }
      if (!report.isArchived) {
        throw new BadRequestError('Report is not archived.');
      }

      report.isArchived = false;
      report.archivedAt = null;
      await report.save({ session: activeSession });

      return {
        reportId: report._id.toString(),
        isArchived: false,
        message: 'Report restored successfully.',
      };
    });
  },

  /**
   * 12. delete_report_permanently
   */
  delete_report_permanently: async ({ args = {}, userId, session = null }) => {
    const { reportId } = args;
    if (!isValidObjectId(reportId)) {
      throw new ValidationError('Invalid report ID.');
    }

    const audioPathsToUnlink = [];

    await runInTransaction(session, async (activeSession) => {
      const report = await Report.findOne({ _id: reportId, user: userId }).session(activeSession);
      if (!report) {
        throw new NotFoundError('Report not found.');
      }
      if (!report.isArchived) {
        throw new BadRequestError(
          'Only archived reports can be permanently deleted. Please archive the report first.'
        );
      }

      // Collect audio filepaths to unlink post-commit
      if (report.audios && report.audios.length > 0) {
        const audioDocs = await Audio.find({
          _id: { $in: report.audios },
          user: userId,
        })
          .select('path')
          .session(activeSession)
          .lean();

        for (const a of audioDocs) {
          if (a.path) audioPathsToUnlink.push(a.path);
        }

        await Audio.deleteMany({
          _id: { $in: report.audios },
          user: userId,
        }).session(activeSession);
      }

      await Report.deleteOne({ _id: reportId }).session(activeSession);
    });

    // Clean post-commit unlink of audio binaries from disk
    for (const audioPath of audioPathsToUnlink) {
      try {
        const resolvedPath = path.resolve(audioPath);
        await fs.promises.unlink(resolvedPath);
        logger.info(`[Report Tool Deletion] Unlinked audio binary: ${resolvedPath}`);
      } catch (unlinkErr) {
        if (unlinkErr.code !== 'ENOENT') {
          logger.warn(
            `[Report Tool Deletion] Failed to unlink audio binary ${audioPath}: ${unlinkErr.message}`
          );
        }
      }
    }

    return {
      reportId,
      message: 'Report permanently deleted successfully.',
    };
  },

  // ----------------------------------------------------------------------------
  // Category 3: Enterprise Intelligence & Cross-Branch Queries
  // ----------------------------------------------------------------------------

  /**
   * 13. query_historical_reports
   */
  query_historical_reports: async ({ args = {}, userId }) => {
    const status = args.status || 'active';
    const query = { user: userId };

    if (status === 'active') {
      query.isArchived = false;
    } else if (status === 'archived') {
      query.isArchived = true;
    }

    // Branch filter: plural branchIds or singular branchId
    const rawBranchIds = args.branchIds || (args.branchId ? [args.branchId] : []);
    if (rawBranchIds.length > 0) {
      const resolvedIds = await resolveBranchObjectIds(rawBranchIds, userId);
      if (resolvedIds.length > 0) {
        query['visits.branch'] = { $in: resolvedIds };
      }
    }

    // Date filters
    if (args.date) {
      const targetDate = new Date(args.date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (args.startDate || args.endDate) {
      query.date = {};
      if (args.startDate) query.date.$gte = new Date(args.startDate);
      if (args.endDate) query.date.$lte = new Date(args.endDate);
    }

    // Keyword filter
    if (args.keyword && typeof args.keyword === 'string' && args.keyword.trim()) {
      query.transcription = new RegExp(escapeRegex(args.keyword.trim()), 'i');
    }

    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);

    const reports = await Report.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('visits.branch', 'name code')
      .select('date clockIn clockOut visits activities issues comments transcription isArchived createdAt')
      .lean();

    return {
      reports: reports.map((r) => ({
        reportId: r._id.toString(),
        date: r.date,
        ethiopianDate: toEthiopianDateString(r.date),
        isArchived: r.isArchived,
        visits: (r.visits || []).map((v) => ({
          branchName: v.branch?.name || 'Unknown',
          branchCode: v.branch?.code || 'N/A',
          clockIn: v.clockIn,
          clockOut: v.clockOut,
        })),
        activitiesCount: r.activities?.length || 0,
        issuesCount: r.issues?.length || 0,
        openIssues: (r.issues || [])
          .filter((i) => i.status !== 'completed' && i.status !== 'no_issue')
          .map((i) => ({
            itemId: i._id.toString(),
            text: i.text,
            status: i.status,
          })),
        transcription: r.transcription,
      })),
      count: reports.length,
    };
  },

  /**
   * 14. query_branch_records
   */
  query_branch_records: async ({ args = {}, userId }) => {
    const query = { user: userId, isArchived: false };

    // Branch filter: plural branchIds or singular branchId
    const rawBranchIds = args.branchIds || (args.branchId ? [args.branchId] : []);
    if (rawBranchIds.length > 0) {
      const resolvedIds = await resolveBranchObjectIds(rawBranchIds, userId);
      if (resolvedIds.length > 0) {
        query['visits.branch'] = { $in: resolvedIds };
      }
    }

    // Date filters
    if (args.date) {
      const targetDate = new Date(args.date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (args.startDate || args.endDate) {
      query.date = {};
      if (args.startDate) query.date.$gte = new Date(args.startDate);
      if (args.endDate) query.date.$lte = new Date(args.endDate);
    }

    const reports = await Report.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(30)
      .populate('visits.branch', 'name code')
      .lean();

    const recordType = args.recordType || 'all';
    const statusFilter = args.status && args.status !== 'all' ? args.status : null;
    const keywordFilter = args.keyword && typeof args.keyword === 'string' ? args.keyword.trim().toLowerCase() : null;
    const maxLimit = Math.min(Math.max(Number(args.limit) || 15, 1), 50);

    const results = [];

    for (const report of reports) {
      const reportMeta = {
        reportId: report._id.toString(),
        date: report.date,
        ethiopianDate: toEthiopianDateString(report.date),
        branches: (report.visits || []).map((v) => v.branch?.name || v.branch?.code || 'Branch'),
      };

      // Issues
      if (recordType === 'all' || recordType === 'issues') {
        for (const issue of report.issues || []) {
          const matchesStatus = !statusFilter || issue.status === statusFilter;
          const matchesKeyword = !keywordFilter || issue.text.toLowerCase().includes(keywordFilter);
          if (matchesStatus && matchesKeyword) {
            results.push({
              type: 'issue',
              itemId: issue._id.toString(),
              text: issue.text,
              status: issue.status,
              ...reportMeta,
            });
            if (results.length >= maxLimit) break;
          }
        }
      }
      if (results.length >= maxLimit) break;

      // Activities
      if (recordType === 'all' || recordType === 'activities') {
        for (const act of report.activities || []) {
          const matchesStatus = !statusFilter || act.status === statusFilter;
          const matchesKeyword = !keywordFilter || act.text.toLowerCase().includes(keywordFilter);
          if (matchesStatus && matchesKeyword) {
            results.push({
              type: 'activity',
              itemId: act._id.toString(),
              text: act.text,
              status: act.status,
              ...reportMeta,
            });
            if (results.length >= maxLimit) break;
          }
        }
      }
      if (results.length >= maxLimit) break;

      // Visits
      if (recordType === 'all' || recordType === 'visits') {
        for (const visit of report.visits || []) {
          const bName = visit.branch?.name || visit.branch?.code || 'Branch';
          const matchesKeyword = !keywordFilter || bName.toLowerCase().includes(keywordFilter);
          if (matchesKeyword) {
            results.push({
              type: 'visit',
              itemId: visit._id?.toString() || reportMeta.reportId,
              branchName: bName,
              clockIn: visit.clockIn,
              clockOut: visit.clockOut,
              ...reportMeta,
            });
            if (results.length >= maxLimit) break;
          }
        }
      }
      if (results.length >= maxLimit) break;

      // Comments
      if (recordType === 'all' || recordType === 'comments') {
        for (const com of report.comments || []) {
          const matchesKeyword = !keywordFilter || com.text.toLowerCase().includes(keywordFilter);
          if (matchesKeyword) {
            results.push({
              type: 'comment',
              itemId: com._id.toString(),
              text: com.text,
              ...reportMeta,
            });
            if (results.length >= maxLimit) break;
          }
        }
      }
      if (results.length >= maxLimit) break;
    }

    return {
      records: results,
      count: results.length,
    };
  },

  // ----------------------------------------------------------------------------
  // Category 4: External Channels, Export & Directives SSOT
  // ----------------------------------------------------------------------------

  /**
   * 15. manage_google_drive
   */
  manage_google_drive: async ({ args = {}, userId }) => {
    return await manageGoogleDrive(userId, args);
  },

  /**
   * 16. create_cloud_document
   */
  create_cloud_document: async ({ args = {}, userId }) => {
    return await createCloudDocument(userId, args);
  },

  /**
   * 17. generate_document_file
   */
  generate_document_file: async ({ args = {}, userId }) => {
    return await generateDocumentFile(userId, args);
  },

  /**
   * 16. share_to_telegram
   */
  share_to_telegram: async ({ args = {}, userId }) => {
    const {
      reportId,
      messageText,
      targetChannel = 'management',
      customNote,
      asImage = false,
    } = args;

    // Load owning supervisor for custom Telegram settings & templates (including botToken for runtime dispatch)
    const user = userId
      ? await User.findById(userId)
          .select('+integrations.telegram.botToken')
          .lean()
      : null;

    let payloadText = '';

    if (reportId && isValidObjectId(reportId)) {
      const report = await Report.findOne({ _id: reportId, user: userId })
        .populate('visits.branch', 'name code')
        .lean();

      if (report) {
        // Zero Artificial Wrapper Law: Use authoritative transcription matching user's template
        if (report.transcription && typeof report.transcription === 'string' && report.transcription.trim()) {
          payloadText = report.transcription.trim();
        } else {
          // Dynamic report serialization respecting user.settings.reportTemplates (Zero Hardcoding)
          let customTpl = null;
          if (user?.settings?.reportTemplates) {
            const isMulti = (report.visits || []).length > 1;
            customTpl = isMulti
              ? user.settings.reportTemplates.multiBranch
              : user.settings.reportTemplates.singleBranch;
          }

          const ethDate = toEthiopianDateString(report.date);
          const visits = (report.visits || [])
            .map((v) => `• ${v.branch?.name || 'Branch'} (${v.clockIn || '--:--'} - ${v.clockOut || '--:--'})`)
            .join('\n');
          const activities = (report.activities || []).map((a) => `• ${a.text}`).join('\n');
          const issues = (report.issues || []).map((i) => `• ${i.text} (${i.status})`).join('\n');
          const comments = (report.comments || []).map((c) => `• ${c.text}`).join('\n');

          if (customTpl && typeof customTpl === 'string' && customTpl.trim()) {
            payloadText = customTpl
              .replace(/\{\{date\}\}/g, ethDate)
              .replace(/\{\{clockIn\}\}/g, report.clockIn || '')
              .replace(/\{\{clockOut\}\}/g, report.clockOut || '')
              .replace(/\{\{visits\}\}/g, visits)
              .replace(/\{\{activities\}\}/g, activities)
              .replace(/\{\{issues\}\}/g, issues)
              .replace(/\{\{comments\}\}/g, comments)
              .trim();
          } else {
            const parts = [
              `ቀን: ${ethDate}`,
              visits ? `ጉብኝት:\n${visits}` : null,
              report.clockIn ? `ስራ የገባሁበት ሰዓት: ${report.clockIn}` : null,
              activities ? `የተሰሩ ስራዎች:\n${activities}` : null,
              issues ? `መፍትሄ የሚፈልጉ ጉዳዮች:\n${issues}` : null,
              comments ? `አጠቃላይ አስተያየት:\n${comments}` : null,
              report.clockOut ? `ከስራ የወጣሁበት ሰዓት: ${report.clockOut}` : null,
            ].filter(Boolean);

            payloadText = parts.join('\n\n');
          }
        }
      } else {
        throw new NotFoundError('Report could not be found for Telegram sharing.');
      }
    } else if (messageText && typeof messageText === 'string' && messageText.trim()) {
      // Ad-hoc text: pure pass-through without synthetic wrappers
      payloadText = messageText.trim();
    } else {
      throw new BadRequestError('Either reportId or messageText must be provided for Telegram sharing.');
    }

    const userTelegram = user?.integrations?.telegram || {};
    const botToken = resolveBotToken(user);
    const effectiveChannel = targetChannel || 'management';
    const chatId = resolveChannelChatId(user, effectiveChannel);

    // Zero-Crash Invariant: Check if bot token or Telegram integration is not connected
    if (!botToken || userTelegram.connected === false || userTelegram.enabled === false) {
      return {
        success: false,
        isConfigured: false,
        channel: effectiveChannel,
        message: 'Telegram bot integration is not connected or is temporarily disabled. Please connect your bot token under Profile > Telegram Channels.',
        actionRequired: 'CONNECT_TELEGRAM_INTEGRATION',
      };
    }

    // Zero-Crash Invariant: Check if the specific requested channel has a configured chat ID
    if (!chatId) {
      return {
        success: false,
        isConfigured: false,
        channel: effectiveChannel,
        message: `The "${effectiveChannel}" Telegram channel is not configured with a Chat ID. Please set the Chat ID for ${effectiveChannel} under Profile > Telegram Channels or select a configured channel (such as Management).`,
        actionRequired: 'CONFIGURE_CHANNEL_CHAT_ID',
      };
    }

    // Determine format: explicit tool arg asImage (if specified) OR user settings defaultFormat === 'image'
    const shouldPostImage = asImage !== undefined ? Boolean(asImage) : Boolean(userTelegram.defaultFormat === 'image');

    // Extract dynamic formatting options with zero hardcoding
    const savedCardOptions = userTelegram.imageCardOptions || {};
    const imageOptions = { ...savedCardOptions };

    if (args.fontSize !== undefined && args.fontSize !== null) {
      const fsStr = String(args.fontSize).toLowerCase().trim();
      if (fsStr.includes('14') || fsStr.includes('word')) {
        imageOptions.fontSize = 38; // MS Word 14pt equivalent on 1440px canvas
        imageOptions.lineHeight = 48;
      } else if (fsStr === 'small' || fsStr === 'compact') {
        imageOptions.fontSize = 30;
        imageOptions.lineHeight = 38;
      } else if (fsStr === 'large' || fsStr === 'big') {
        imageOptions.fontSize = 44;
        imageOptions.lineHeight = 56;
      } else {
        const num = parseInt(fsStr, 10);
        if (!isNaN(num) && num >= 18 && num <= 72) {
          imageOptions.fontSize = num;
          imageOptions.lineHeight = Math.round(num * 1.26);
        }
      }
    }

    if (args.lineSpacing !== undefined && args.lineSpacing !== null) {
      const lsStr = String(args.lineSpacing).toLowerCase().trim();
      const base = imageOptions.fontSize || 38;
      if (lsStr === 'compact' || lsStr === 'small' || lsStr === 'tight' || lsStr.includes('reduce') || lsStr.includes('less')) {
        imageOptions.lineHeight = Math.round(base * 1.18);
      } else if (lsStr === 'relaxed' || lsStr === 'loose' || lsStr === 'wide' || lsStr.includes('more')) {
        imageOptions.lineHeight = Math.round(base * 1.55);
      } else {
        const num = parseInt(lsStr, 10);
        if (!isNaN(num) && num >= 20 && num <= 120) {
          imageOptions.lineHeight = num;
        }
      }
    }

    if (args.bulletIndent !== undefined && args.bulletIndent !== null) {
      const biStr = String(args.bulletIndent).toLowerCase().trim();
      if (biStr.includes('much') || biStr.includes('extra') || biStr === 'huge') {
        imageOptions.bulletIndent = 80;
      } else if (biStr.includes('more') || biStr === 'large' || biStr === 'wide' || biStr.includes('deep') || biStr.includes('increase')) {
        imageOptions.bulletIndent = 56;
      } else if (biStr.includes('less') || biStr === 'small' || biStr === 'compact' || biStr.includes('tight') || biStr.includes('decrease')) {
        imageOptions.bulletIndent = 20;
      } else {
        const num = parseInt(biStr, 10);
        if (!isNaN(num) && num >= 10 && num <= 200) {
          imageOptions.bulletIndent = num;
        }
      }
    }

    if (args.paddingX !== undefined && args.paddingX !== null) {
      const pxStr = String(args.paddingX).toLowerCase().trim();
      if (pxStr === 'compact' || pxStr === 'narrow' || pxStr === 'small') {
        imageOptions.paddingX = 50;
      } else if (pxStr === 'wide' || pxStr === 'spacious' || pxStr === 'large') {
        imageOptions.paddingX = 120;
      } else {
        const num = parseInt(pxStr, 10);
        if (!isNaN(num) && num >= 30 && num <= 250) {
          imageOptions.paddingX = num;
        }
      }
    }

    if (args.bold !== undefined && args.bold !== null) {
      imageOptions.allBold = Boolean(args.bold);
    }
    if (args.underlineHeaders !== undefined && args.underlineHeaders !== null) {
      imageOptions.underlineHeaders = Boolean(args.underlineHeaders);
    }
    if (args.theme) {
      const thStr = String(args.theme).toLowerCase().trim();
      if (thStr === 'dark') {
        imageOptions.bgColor = '#1E1E1E';
        imageOptions.textColor = '#FFFFFF';
      } else if (thStr === 'light') {
        imageOptions.bgColor = '#FFFFFF';
        imageOptions.textColor = '#000000';
      }
    }

    if (args.fontFamily && typeof args.fontFamily === 'string' && args.fontFamily.trim()) {
      imageOptions.fontFamily = args.fontFamily.trim();
    }
    if (args.textColor && typeof args.textColor === 'string' && args.textColor.trim()) {
      imageOptions.textColor = args.textColor.trim();
    }
    if (args.bgColor && typeof args.bgColor === 'string' && args.bgColor.trim()) {
      imageOptions.bgColor = args.bgColor.trim();
    }
    if (args.align && typeof args.align === 'string') {
      const al = args.align.toLowerCase().trim();
      if (['left', 'center', 'right'].includes(al)) {
        imageOptions.align = al;
      }
    }
    if (args.border !== undefined && args.border !== null) {
      imageOptions.border = Boolean(args.border);
    }
    if (args.letterSpacing !== undefined && args.letterSpacing !== null) {
      imageOptions.letterSpacing = Number(args.letterSpacing) || 0;
    }

    // Persist formatting preferences to user settings if requested
    if (args.saveAsDefault && userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          $set: {
            'integrations.telegram.imageCardOptions': imageOptions,
          },
        });
      } catch (err) {
        logger.warn(`[agentTools] Failed to persist imageCardOptions: ${err.message}`);
      }
    }

    const dispatchResult = await dispatchToTelegram({
      user,
      targetChannel,
      text: payloadText,
      customNote,
      asImage: shouldPostImage,
      options: imageOptions,
    });

    if (!dispatchResult.success && !dispatchResult.ok) {
      const failureReason = dispatchResult.error || 'Unknown Telegram delivery failure';
      let remediationHint = 'Please verify your Telegram configuration under Profile > Telegram.';
      const lower = failureReason.toLowerCase();
      if (lower.includes('chat not found')) {
        remediationHint = 'Ensure the Chat ID is correct (channels start with -100) and the bot is added as an Administrator to the channel with Post Messages permission.';
      } else if (lower.includes('unauthorized') || lower.includes('token')) {
        remediationHint = 'The Telegram Bot Token is invalid or revoked. Please update your bot token in Profile > Telegram.';
      } else if (lower.includes('not a member') || lower.includes('forbidden')) {
        remediationHint = 'The bot does not have permission to post. Please invite the bot to the channel and promote it to Administrator with Post Messages permission.';
      } else if (dispatchResult.isConfigured === false) {
        remediationHint = 'Please connect your Telegram Bot Token and set your Channel ID in Profile > Telegram.';
      }

      return {
        success: false,
        isStub: false,
        isConfigured: dispatchResult.isConfigured !== false,
        channel: 'telegram',
        targetChannel: dispatchResult.channel || targetChannel,
        error: failureReason,
        message: `Failed to dispatch message to Telegram channel '${dispatchResult.channel || targetChannel}': ${failureReason}. ${remediationHint}`,
      };
    }

    return {
      success: true,
      isStub: Boolean(dispatchResult.isStub),
      channel: 'telegram',
      targetChannel: dispatchResult.channel || targetChannel,
      mode: dispatchResult.mode || (shouldPostImage ? 'image' : 'text'),
      messageId: dispatchResult.messageId || null,
      deepLink: dispatchResult.deepLink || null,
      fallbackFromImage: dispatchResult.fallbackFromImage || false,
      message: dispatchResult.isStub
        ? `Telegram dispatch simulated in functional stub mode for channel '${dispatchResult.channel || targetChannel}'.`
        : `Successfully dispatched to Telegram channel '${dispatchResult.channel || targetChannel}' (${dispatchResult.mode === 'image' ? 'Image Card' : 'Semantic Text'}).`,
    };
  },

  /**
   * 17. save_user_directive (targets User.settings.directives)
   */
  save_user_directive: async ({ args = {}, userId, session = null }) => {
    return await toolHandlers.update_user_settings({ args, userId, session });
  },

  /**
   * 17b. save_supervisor_directive (Backwards-compatible wrapper targeting User.settings.directives)
   */
  save_supervisor_directive: async ({ args = {}, userId, session = null }) => {
    return await toolHandlers.update_user_settings({ args, userId, session });
  },

  /**
   * 18. get_user_settings
   */
  get_user_settings: async ({ args = {}, userId, session = null }) => {
    const user = await User.findById(userId).session(session || null).lean();
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const settings = user.settings || {};
    const section = (args.section || 'all').toLowerCase();

    const normalizedDirectives = {
      negativeVocabulary: settings.directives?.negativeVocabulary || [],
      phraseMappings:
        settings.directives?.phraseMappings instanceof Map
          ? Object.fromEntries(settings.directives.phraseMappings)
          : settings.directives?.phraseMappings || {},
      customInstructions: settings.directives?.customInstructions || [],
    };

    const agentConfig = settings.agentConfig || {
      persona: CHAT_CONSTANTS.DEFAULT_PERSONA,
      defaultModel: CHAT_CONSTANTS.DEFAULT_MODEL,
      defaultThinkingBudget: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
      defaultLanguage: CHAT_CONSTANTS.DEFAULT_LANGUAGE,
    };

    const reportTemplates = settings.reportTemplates || {
      singleBranch: null,
      multiBranch: null,
    };

    const sttEngine = settings.sttEngine || CHAT_CONSTANTS.DEFAULT_STT_ENGINE;

    const googleDrive = {
      connected: Boolean(user.integrations?.googleDrive?.connected),
      enabled: user.integrations?.googleDrive?.enabled !== false,
      email: user.integrations?.googleDrive?.email || null,
      rootFolderId: user.integrations?.googleDrive?.rootFolderId || null,
    };

    if (section === 'directives') {
      return { directives: normalizedDirectives };
    }
    if (section === 'agentconfig') {
      return { agentConfig };
    }
    if (section === 'reporttemplates') {
      return { reportTemplates };
    }
    if (section === 'sttengine') {
      return { sttEngine };
    }
    if (section === 'googledrive' || section === 'integrations') {
      return { googleDrive };
    }

    return {
      directives: normalizedDirectives,
      agentConfig,
      reportTemplates,
      sttEngine,
      googleDrive,
    };
  },

  /**
   * 19. update_user_settings
   */
  update_user_settings: async ({ args = {}, userId, session = null }) => {
    return await runInTransaction(session, async (activeSession) => {
      const user = await User.findById(userId).session(activeSession);
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      if (!user.settings) user.settings = {};
      if (!user.settings.directives) {
        user.settings.directives = {
          negativeVocabulary: [],
          phraseMappings: new Map(),
          customInstructions: [],
        };
      }
      if (!user.settings.agentConfig) {
        user.settings.agentConfig = {
          persona: CHAT_CONSTANTS.DEFAULT_PERSONA,
          defaultModel: CHAT_CONSTANTS.DEFAULT_MODEL,
          defaultThinkingBudget: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
          defaultLanguage: CHAT_CONSTANTS.DEFAULT_LANGUAGE,
        };
      }
      if (!user.settings.reportTemplates) {
        user.settings.reportTemplates = {
          singleBranch: null,
          multiBranch: null,
        };
      }

      let changed = false;

      // --- Directives ---
      if (args.clearDirectives === true) {
        user.settings.directives.negativeVocabulary = [];
        user.settings.directives.phraseMappings = new Map();
        user.settings.directives.customInstructions = [];
        changed = true;
      }

      // 1. Negative vocabulary add
      if (Array.isArray(args.negativeVocabularyToAdd)) {
        const existing = new Set(user.settings.directives.negativeVocabulary || []);
        for (const word of args.negativeVocabularyToAdd) {
          if (word && typeof word === 'string' && word.trim()) {
            existing.add(word.trim());
            changed = true;
          }
        }
        user.settings.directives.negativeVocabulary = Array.from(existing);
      }

      // 2. Negative vocabulary remove
      if (Array.isArray(args.negativeVocabularyToRemove)) {
        const toRemove = new Set(args.negativeVocabularyToRemove.map((w) => String(w).trim()));
        user.settings.directives.negativeVocabulary = (
          user.settings.directives.negativeVocabulary || []
        ).filter((w) => !toRemove.has(w));
        changed = true;
      }

      // 3. Phrase mappings add
      if (args.phraseMappingsToAdd) {
        if (!user.settings.directives.phraseMappings) {
          user.settings.directives.phraseMappings = new Map();
        }
        if (Array.isArray(args.phraseMappingsToAdd)) {
          for (const item of args.phraseMappingsToAdd) {
            if (item && typeof item === 'object' && item.key && item.value) {
              user.settings.directives.phraseMappings.set(String(item.key).trim(), String(item.value).trim());
              changed = true;
            }
          }
        } else if (typeof args.phraseMappingsToAdd === 'object') {
          for (const [key, value] of Object.entries(args.phraseMappingsToAdd)) {
            if (key && value && typeof key === 'string' && typeof value === 'string') {
              user.settings.directives.phraseMappings.set(key.trim(), value.trim());
              changed = true;
            }
          }
        }
      }

      // 4. Phrase mappings remove
      if (Array.isArray(args.phraseMappingsToRemove) && user.settings.directives.phraseMappings) {
        for (const key of args.phraseMappingsToRemove) {
          if (typeof key === 'string' && user.settings.directives.phraseMappings.has(key.trim())) {
            user.settings.directives.phraseMappings.delete(key.trim());
            changed = true;
          }
        }
      }

      // 5. Custom instructions add
      if (Array.isArray(args.customInstructionsToAdd)) {
        const existing = new Set(user.settings.directives.customInstructions || []);
        for (const inst of args.customInstructionsToAdd) {
          if (inst && typeof inst === 'string' && inst.trim()) {
            existing.add(inst.trim());
            changed = true;
          }
        }
        user.settings.directives.customInstructions = Array.from(existing);
      }

      // 6. Custom instructions remove
      if (Array.isArray(args.customInstructionsToRemove)) {
        const toRemove = new Set(args.customInstructionsToRemove.map((i) => String(i).trim()));
        user.settings.directives.customInstructions = (
          user.settings.directives.customInstructions || []
        ).filter((i) => !toRemove.has(i));
        changed = true;
      }

      // --- Agent Config ---
      if (args.resetAgentConfig === true) {
        user.settings.agentConfig = {
          persona: CHAT_CONSTANTS.DEFAULT_PERSONA,
          defaultModel: CHAT_CONSTANTS.DEFAULT_MODEL,
          defaultThinkingBudget: CHAT_CONSTANTS.DEFAULT_THINKING_BUDGET,
          defaultLanguage: CHAT_CONSTANTS.DEFAULT_LANGUAGE,
        };
        changed = true;
      } else {
        if (args.persona !== undefined && typeof args.persona === 'string' && args.persona.trim()) {
          user.settings.agentConfig.persona = args.persona.trim();
          changed = true;
        }
        if (args.defaultModel !== undefined && typeof args.defaultModel === 'string' && args.defaultModel.trim()) {
          const modelVal = args.defaultModel.trim();
          if (CHAT_CONSTANTS.SUPPORTED_MODELS.includes(modelVal)) {
            user.settings.agentConfig.defaultModel = modelVal;
            changed = true;
          }
        }
        if (args.defaultThinkingBudget !== undefined && typeof args.defaultThinkingBudget === 'number') {
          const budget = Math.max(
            CHAT_CONSTANTS.MIN_THINKING_BUDGET,
            Math.min(CHAT_CONSTANTS.MAX_THINKING_BUDGET, Math.round(args.defaultThinkingBudget))
          );
          user.settings.agentConfig.defaultThinkingBudget = budget;
          changed = true;
        }
        if (args.defaultLanguage !== undefined && typeof args.defaultLanguage === 'string' && args.defaultLanguage.trim()) {
          const langVal = args.defaultLanguage.trim().toLowerCase();
          if (CHAT_CONSTANTS.SUPPORTED_LANGUAGES.includes(langVal)) {
            user.settings.agentConfig.defaultLanguage = langVal;
            changed = true;
          }
        }
      }

      // --- STT Engine ---
      if (args.sttEngine !== undefined && typeof args.sttEngine === 'string' && args.sttEngine.trim()) {
        const engineVal = args.sttEngine.trim();
        if (CHAT_CONSTANTS.STT_ENGINES.includes(engineVal)) {
          user.settings.sttEngine = engineVal;
          changed = true;
        }
      }

      // --- Report Templates ---
      if (args.resetSingleBranchTemplate === true) {
        user.settings.reportTemplates.singleBranch = null;
        changed = true;
      } else if (args.singleBranchTemplate !== undefined) {
        user.settings.reportTemplates.singleBranch =
          args.singleBranchTemplate && typeof args.singleBranchTemplate === 'string' && args.singleBranchTemplate.trim()
            ? args.singleBranchTemplate.trim()
            : null;
        changed = true;
      }

      if (args.resetMultiBranchTemplate === true) {
        user.settings.reportTemplates.multiBranch = null;
        changed = true;
      } else if (args.multiBranchTemplate !== undefined) {
        user.settings.reportTemplates.multiBranch =
          args.multiBranchTemplate && typeof args.multiBranchTemplate === 'string' && args.multiBranchTemplate.trim()
            ? args.multiBranchTemplate.trim()
            : null;
        changed = true;
      }

      // --- Google Drive Integration Enabled Toggle ---
      if (typeof args.googleDriveEnabled === 'boolean' && user.integrations?.googleDrive) {
        user.integrations.googleDrive.enabled = args.googleDriveEnabled;
        changed = true;
      }

      if (changed) {
        await user.save({ session: activeSession });
      }

      const normalizedMappings =
        user.settings.directives.phraseMappings instanceof Map
          ? Object.fromEntries(user.settings.directives.phraseMappings)
          : user.settings.directives.phraseMappings || {};

      return {
        directives: {
          negativeVocabulary: user.settings.directives.negativeVocabulary || [],
          phraseMappings: normalizedMappings,
          customInstructions: user.settings.directives.customInstructions || [],
        },
        agentConfig: user.settings.agentConfig,
        sttEngine: user.settings.sttEngine,
        reportTemplates: user.settings.reportTemplates || {},
        googleDrive: {
          connected: Boolean(user.integrations?.googleDrive?.connected),
          enabled: user.integrations?.googleDrive?.enabled !== false,
          email: user.integrations?.googleDrive?.email || null,
        },
        message: 'User settings successfully updated in MongoDB Single Source of Truth.',
      };
    });
  },
};

/**
 * ==============================================================================
 * 3. Unified In-Process Tool Dispatcher
 * ==============================================================================
 * Safely executes requested tool with error containment so errors do not crash chat streaming.
 *
 * @param {string} toolName - Name of the tool called by Gemini.
 * @param {object} args - Arguments generated by Gemini.
 * @param {object} context - Execution context { userId, session }.
 * @returns {Promise<{ success: boolean, data?: any, error?: string, details?: any }>}
 */
export async function executeAgentTool(toolName, args = {}, { userId, session = null } = {}) {
  const handler = toolHandlers[toolName];
  if (!handler) {
    return {
      success: false,
      error: `Unknown tool "${toolName}". Available tools: ${Object.keys(toolHandlers).join(', ')}`,
    };
  }

  try {
    const data = await handler({ args, userId, session });
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Tool execution failed.',
      details: err.details || err.errors || null,
    };
  }
}

export default {
  agentToolDeclarations,
  toolHandlers,
  executeAgentTool,
};
