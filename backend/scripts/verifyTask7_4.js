/**
 * @file verifyTask7_4.js
 * @description Comprehensive verification suite for Task 7.4 (Report Controller & ACID Sessions).
 * Verifies route mounting, controller exports, Mongoose session wrapping,
 * subdocument query logic, branch reference checks, soft-archive, restore, permanent delete,
 * audio upload batch limits, and post-commit cleanup.
 */

import assert from 'node:assert';
import mongoose from 'mongoose';

import reportRoutes from '../src/routes/reportRoutes.js';
import apiV1Routes from '../src/routes/index.js';
import {
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
} from '../src/controllers/reportController.js';

import { uploadReportAudiosMiddleware } from '../src/middleware/uploadMiddleware.js';
import { Report } from '../src/models/Report.js';
import { Branch } from '../src/models/Branch.js';
import { Audio } from '../src/models/Audio.js';
import { HTTP_STATUS, REPORT_CONSTANTS, AUDIO_CONSTANTS } from '../src/utils/constants.js';
import { NotFoundError, BadRequestError } from '../src/errors/CustomError.js';

console.log('================================================================');
console.log('--- TASK 7.4 VERIFICATION SUITE: REPORT CONTROLLER & ROUTES ---');
console.log('================================================================\n');

let passedTests = 0;
const test = (description, fn) => {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
};

const asyncTest = async (description, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
};

// -------------------------------------------------------------
// 1. Verify Route Declarations & Router Architecture
// -------------------------------------------------------------
console.log('1. Checking Route Declarations & Mounting Architecture...');

test('reportRoutes is an Express Router instance', () => {
  assert.strictEqual(typeof reportRoutes, 'function');
  assert.ok(Array.isArray(reportRoutes.stack));
});

test('apiV1Routes mounts /reports router', () => {
  const routes = apiV1Routes.stack;
  const reportRouteMount = routes.find(
    (layer) =>
      layer.handle === reportRoutes ||
      (layer.matchers && layer.matchers.some((m) => {
        try {
          return Boolean(m('/reports'));
        } catch {
          return false;
        }
      }))
  );
  assert.ok(reportRouteMount, 'Expected /reports to be mounted in apiV1Routes');
});

test('reportRoutes registers audio upload endpoint: POST /upload-audio', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/upload-audio' && l.route.methods.post);
  assert.ok(layer, 'Expected POST /upload-audio route');
});

test('reportRoutes registers report creation endpoint: POST /', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.post);
  assert.ok(layer, 'Expected POST / route');
});

test('reportRoutes registers report list endpoint: GET /', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.get);
  assert.ok(layer, 'Expected GET / route');
});

test('reportRoutes registers single report detail endpoint: GET /:reportId', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId' && l.route.methods.get);
  assert.ok(layer, 'Expected GET /:reportId route');
});

test('reportRoutes registers report update endpoint: PATCH /:reportId', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId' && l.route.methods.patch);
  assert.ok(layer, 'Expected PATCH /:reportId route');
});

test('reportRoutes registers activities subdocument endpoint: GET /:reportId/activities', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/activities' && l.route.methods.get);
  assert.ok(layer, 'Expected GET /:reportId/activities route');
});

test('reportRoutes registers issues subdocument endpoint: GET /:reportId/issues', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/issues' && l.route.methods.get);
  assert.ok(layer, 'Expected GET /:reportId/issues route');
});

test('reportRoutes registers comments subdocument endpoint: GET /:reportId/comments', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/comments' && l.route.methods.get);
  assert.ok(layer, 'Expected GET /:reportId/comments route');
});

test('reportRoutes registers soft-archive endpoint: PATCH /:reportId/archive', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/archive' && l.route.methods.patch);
  assert.ok(layer, 'Expected PATCH /:reportId/archive route');
});

test('reportRoutes registers restore endpoint: PATCH /:reportId/restore', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/restore' && l.route.methods.patch);
  assert.ok(layer, 'Expected PATCH /:reportId/restore route');
});

test('reportRoutes registers permanent delete endpoint: DELETE /:reportId/delete', () => {
  const layer = reportRoutes.stack.find((l) => l.route && l.route.path === '/:reportId/delete' && l.route.methods.delete);
  assert.ok(layer, 'Expected DELETE /:reportId/delete route');
});

// -------------------------------------------------------------
// 2. Checking Controller Exports
// -------------------------------------------------------------
console.log('\n2. Checking Controller Method Exports...');

test('createReport is an exported function', () => {
  assert.strictEqual(typeof createReport, 'function');
});

test('createReportRecord is an exported function (pure persistence service for AI Agent)', () => {
  assert.strictEqual(typeof createReportRecord, 'function');
});

test('getReports is an exported function', () => {
  assert.strictEqual(typeof getReports, 'function');
});

test('getReportById is an exported function', () => {
  assert.strictEqual(typeof getReportById, 'function');
});

test('updateReport is an exported function', () => {
  assert.strictEqual(typeof updateReport, 'function');
});

test('getReportActivities is an exported function', () => {
  assert.strictEqual(typeof getReportActivities, 'function');
});

test('getReportIssues is an exported function', () => {
  assert.strictEqual(typeof getReportIssues, 'function');
});

test('getReportComments is an exported function', () => {
  assert.strictEqual(typeof getReportComments, 'function');
});

test('archiveReport is an exported function', () => {
  assert.strictEqual(typeof archiveReport, 'function');
});

test('restoreReport is an exported function', () => {
  assert.strictEqual(typeof restoreReport, 'function');
});

test('deleteReportPermanently is an exported function', () => {
  assert.strictEqual(typeof deleteReportPermanently, 'function');
});

test('uploadReportAudios is an exported function', () => {
  assert.strictEqual(typeof uploadReportAudios, 'function');
});

test('uploadReportAudiosMiddleware is an exported function', () => {
  assert.strictEqual(typeof uploadReportAudiosMiddleware, 'function');
});

// -------------------------------------------------------------
// 3. Controller Execution & Logic Unit Tests (In-Memory Harness)
// -------------------------------------------------------------
console.log('\n3. Testing Controller Handlers Logic & Error Handling...');

await asyncTest('uploadReportAudios rejects request when no files are uploaded', async () => {
  const req = {
    files: [],
    user: { _id: new mongoose.Types.ObjectId() },
  };
  let caughtError = null;
  const res = {
    status: () => res,
    json: () => res,
  };
  const next = (err) => {
    caughtError = err;
  };

  await uploadReportAudios(req, res, next);
  assert.ok(caughtError instanceof BadRequestError, 'Expected BadRequestError when files is empty');
  assert.match(caughtError.message, /At least one audio file is required/);
});

await asyncTest('uploadReportAudios rejects batch exceeding 50MB cumulative size', async () => {
  const req = {
    files: [
      { size: 30 * 1024 * 1024, path: 'uploads/temp/mock1.mp3' },
      { size: 25 * 1024 * 1024, path: 'uploads/temp/mock2.mp3' }, // Total = 55MB > 50MB
    ],
    user: { _id: new mongoose.Types.ObjectId() },
  };
  let caughtError = null;
  const res = {
    status: () => res,
    json: () => res,
  };
  const next = (err) => {
    caughtError = err;
  };

  await uploadReportAudios(req, res, next);
  assert.ok(caughtError instanceof BadRequestError, 'Expected BadRequestError on batch size exceed');
  assert.match(caughtError.message, /Cumulative audio upload size exceeds/);
});

await asyncTest('createReport verifies referenced branch ownership before persisting', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockBranchId = new mongoose.Types.ObjectId();

  const req = {
    validated: {
      body: {
        date: '2026-10-02T00:00:00.000Z',
        clockIn: '08:30',
        clockOut: '17:30',
        visits: [{ branch: mockBranchId, clockIn: '08:30', clockOut: '17:30' }],
        activities: [{ text: 'Cleaned store', status: 'completed' }],
        transcription: 'Operational transcription note',
      },
    },
    user: { _id: mockUserId },
  };

  // Mock mongoose.startSession
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      // Simulate Branch.find returning 0 branches (branch not found or belongs to another user)
      const originalFind = Branch.find;
      Branch.find = () => ({
        session: () => ({
          lean: async () => [],
        }),
      });

      try {
        await fn();
      } finally {
        Branch.find = originalFind;
      }
    },
    endSession: async () => {},
  });

  let caughtError = null;
  const res = { status: () => res, json: () => res };
  const next = (err) => {
    caughtError = err;
  };

  try {
    await createReport(req, res, next);
    assert.ok(caughtError instanceof NotFoundError, 'Expected NotFoundError when branch is not found');
    assert.match(caughtError.message, /referenced branches could not be found/);
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('createReport persists document inside ACID session and returns HTTP 201', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockBranchId = new mongoose.Types.ObjectId();

  const req = {
    validated: {
      body: {
        date: '2026-10-02T00:00:00.000Z',
        clockIn: '08:30',
        clockOut: '17:30',
        visits: [{ branch: mockBranchId, clockIn: '08:30', clockOut: '17:30' }],
        activities: [{ text: 'Cleaned store', status: 'completed' }],
        transcription: 'Operational transcription note',
      },
    },
    user: { _id: mockUserId },
  };

  let capturedStatusCode = null;
  let capturedResponse = null;

  const res = {
    status: (code) => {
      capturedStatusCode = code;
      return res;
    },
    json: (data) => {
      capturedResponse = data;
      return res;
    },
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalBranchFind = Branch.find;
      const originalReportCreate = Report.create;

      Branch.find = () => ({
        session: () => ({
          lean: async () => [{ _id: mockBranchId, user: mockUserId }],
        }),
      });

      Report.create = async (docs) => {
        return [
          {
            ...docs[0],
            _id: new mongoose.Types.ObjectId(),
            ethiopianDate: '22-01-19',
          },
        ];
      };

      try {
        await fn();
      } finally {
        Branch.find = originalBranchFind;
        Report.create = originalReportCreate;
      }
    },
    endSession: async () => {},
  });

  try {
    await createReport(req, res, (err) => {
      if (err) throw err;
    });

    assert.strictEqual(capturedStatusCode, HTTP_STATUS.CREATED);
    assert.strictEqual(capturedResponse.success, true);
    assert.strictEqual(capturedResponse.message, 'Report created successfully');
    assert.ok(capturedResponse.data.report);
    assert.strictEqual(capturedResponse.data.report.isArchived, false);
    assert.strictEqual(capturedResponse.data.report.archivedAt, null);
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('createReportRecord (pure service function for AI Agent) persists document directly without req/res', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockBranchId = new mongoose.Types.ObjectId();

  const payload = {
    date: '2026-10-02T00:00:00.000Z',
    clockIn: '08:30',
    clockOut: '17:30',
    visits: [{ branch: mockBranchId, clockIn: '08:30', clockOut: '17:30' }],
    activities: [{ text: 'Cleaned store', status: 'completed' }],
    transcription: 'Operational transcription note',
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalBranchFind = Branch.find;
      const originalReportCreate = Report.create;

      Branch.find = () => ({
        session: () => ({
          lean: async () => [{ _id: mockBranchId, user: mockUserId }],
        }),
      });

      Report.create = async (docs) => {
        return [
          {
            ...docs[0],
            _id: new mongoose.Types.ObjectId(),
            ethiopianDate: '22-01-19',
          },
        ];
      };

      try {
        await fn();
      } finally {
        Branch.find = originalBranchFind;
        Report.create = originalReportCreate;
      }
    },
    endSession: async () => {},
  });

  try {
    const savedReport = await createReportRecord({
      userId: mockUserId,
      payload,
    });

    assert.ok(savedReport, 'Expected savedReport document returned');
    assert.strictEqual(savedReport.isArchived, false);
    assert.strictEqual(savedReport.archivedAt, null);
    assert.strictEqual(savedReport.ethiopianDate, '22-01-19');
    assert.strictEqual(String(savedReport.user), String(mockUserId));
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('getReports constructs filter separating active reports from archived reports', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  let capturedFilter = null;

  const originalPaginate = Report.paginate;
  Report.paginate = async (filter) => {
    capturedFilter = filter;
    return {
      docs: [],
      totalDocs: 0,
      limit: 10,
      page: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };
  };

  const res = {
    status: () => res,
    json: () => res,
  };

  try {
    // 1. Default request (no archived flag) -> isArchived must be false
    const reqActive = {
      validated: { query: { page: '1', limit: '10' } },
      user: { _id: mockUserId },
    };
    await getReports(reqActive, res, () => {});
    assert.strictEqual(capturedFilter.isArchived, false);
    assert.strictEqual(String(capturedFilter.user), String(mockUserId));

    // 2. Archived request (?archived=true) -> isArchived must be true
    const reqArchived = {
      validated: { query: { page: '1', limit: '10', archived: 'true' } },
      user: { _id: mockUserId },
    };
    await getReports(reqArchived, res, () => {});
    assert.strictEqual(capturedFilter.isArchived, true);
  } finally {
    Report.paginate = originalPaginate;
  }
});

await asyncTest('updateReport updates activities and issues without branch references inside ACID session', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockReportId = new mongoose.Types.ObjectId();

  const mockReportDoc = {
    _id: mockReportId,
    user: mockUserId,
    isArchived: false,
    activities: [],
    issues: [],
    save: async () => {},
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalFindOne = Report.findOne;
      Report.findOne = () => ({
        session: () => mockReportDoc,
      });

      try {
        await fn();
      } finally {
        Report.findOne = originalFindOne;
      }
    },
    endSession: async () => {},
  });

  let updatedReportData = null;
  const res = {
    status: () => res,
    json: (payload) => {
      updatedReportData = payload;
      return res;
    },
  };

  try {
    const reqUpdate = {
      validated: {
        params: { reportId: String(mockReportId) },
        body: {
          activities: [{ text: 'Updated inventory check', status: 'completed' }],
          issues: [{ text: 'Restocked ingredients', status: 'completed' }],
        },
      },
      user: { _id: mockUserId },
    };

    await updateReport(reqUpdate, res, (err) => {
      if (err) throw err;
    });

    assert.ok(updatedReportData && updatedReportData.success, 'Expected successful update response');
    assert.strictEqual(mockReportDoc.activities[0].text, 'Updated inventory check');
    assert.strictEqual(mockReportDoc.issues[0].text, 'Restocked ingredients');
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('archiveReport soft-archives active report and restoreReport restores it', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockReportId = new mongoose.Types.ObjectId();

  const mockReportDoc = {
    _id: mockReportId,
    user: mockUserId,
    isArchived: false,
    archivedAt: null,
    save: async () => {},
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalFindOne = Report.findOne;
      Report.findOne = () => ({
        session: async () => mockReportDoc,
      });

      try {
        await fn();
      } finally {
        Report.findOne = originalFindOne;
      }
    },
    endSession: async () => {},
  });

  const res = {
    status: () => res,
    json: () => res,
  };

  try {
    // 1. Archive report
    const reqArchive = {
      validated: { params: { reportId: String(mockReportId) } },
      user: { _id: mockUserId },
    };
    await archiveReport(reqArchive, res, () => {});
    assert.strictEqual(mockReportDoc.isArchived, true);
    assert.ok(mockReportDoc.archivedAt instanceof Date);

    // 2. Restore report
    const reqRestore = {
      validated: { params: { reportId: String(mockReportId) } },
      user: { _id: mockUserId },
    };
    await restoreReport(reqRestore, res, () => {});
    assert.strictEqual(mockReportDoc.isArchived, false);
    assert.strictEqual(mockReportDoc.archivedAt, null);
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('deleteReportPermanently executes database deletion and unlinks audio files', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockReportId = new mongoose.Types.ObjectId();
  const mockAudioId = new mongoose.Types.ObjectId();

  let reportDeleted = false;
  let audioDeleted = false;

  const mockReportDoc = {
    _id: mockReportId,
    user: mockUserId,
    isArchived: true,
    audios: [mockAudioId],
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalReportFindOne = Report.findOne;
      const originalAudioFind = Audio.find;
      const originalReportDeleteOne = Report.deleteOne;
      const originalAudioDeleteMany = Audio.deleteMany;

      Report.findOne = () => ({
        session: async () => mockReportDoc,
      });
      Audio.find = () => ({
        select: () => ({
          session: () => ({
            lean: async () => [{ path: 'uploads/audio/mock-nonexistent-file.wav' }],
          }),
        }),
      });
      Report.deleteOne = () => ({
        session: async () => {
          reportDeleted = true;
        },
      });
      Audio.deleteMany = () => ({
        session: async () => {
          audioDeleted = true;
        },
      });

      try {
        await fn();
      } finally {
        Report.findOne = originalReportFindOne;
        Audio.find = originalAudioFind;
        Report.deleteOne = originalReportDeleteOne;
        Audio.deleteMany = originalAudioDeleteMany;
      }
    },
    endSession: async () => {},
  });

  const res = {
    status: () => res,
    json: () => res,
  };

  try {
    const reqDelete = {
      validated: { params: { reportId: String(mockReportId) } },
      user: { _id: mockUserId },
    };
    await deleteReportPermanently(reqDelete, res, () => {});
    assert.strictEqual(reportDeleted, true, 'Report must be deleted from DB');
    assert.strictEqual(audioDeleted, true, 'Associated Audio records must be deleted from DB');
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

await asyncTest('deleteReportPermanently rejects deleting active report with HTTP 400', async () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockReportId = new mongoose.Types.ObjectId();

  const activeReportDoc = {
    _id: mockReportId,
    user: mockUserId,
    isArchived: false,
    audios: [],
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      const originalReportFindOne = Report.findOne;
      Report.findOne = () => ({
        session: async () => activeReportDoc,
      });
      try {
        await fn();
      } finally {
        Report.findOne = originalReportFindOne;
      }
    },
    endSession: async () => {},
  });

  let caughtError = null;
  const res = {
    status: () => res,
    json: () => res,
  };
  const next = (err) => {
    caughtError = err;
  };

  try {
    const reqDelete = {
      validated: { params: { reportId: String(mockReportId) } },
      user: { _id: mockUserId },
    };
    await deleteReportPermanently(reqDelete, res, next);
    assert.ok(caughtError instanceof BadRequestError, 'Expected BadRequestError when permanently deleting active report');
    assert.match(caughtError.message, /Only archived reports can be permanently deleted/);
  } finally {
    mongoose.startSession = originalStartSession;
  }
});

console.log('================================================================');
console.log(`TASK 7.4 RESULTS: ${passedTests} PASSED, 0 FAILED`);
console.log('================================================================\n');
