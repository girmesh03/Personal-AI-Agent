/**
 * @module controllers/dashboardController
 * @description Executive operational intelligence and platform metrics controller.
 * Aggregates KPIs, branch inspection frequency distribution, 14-day continuous audit trend,
 * recurring issues breakdown, and recent reports ledger with strict tenant isolation.
 */

import asyncHandler from 'express-async-handler';
import { Branch } from '../models/Branch.js';
import { Report } from '../models/Report.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * Month names for 14-day timeline formatting.
 * @constant {string[]}
 */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Retrieves aggregated operational metrics and analytics for the authenticated supervisor.
 *
 * @function getDashboardMetrics
 * @param {import('express').Request} req - Express request object containing req.user._id.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Time boundary calculations
  const today = new Date();
  
  // Trailing 7 days for auditsThisWeek
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Trailing 14 days for auditVolumeTrend
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  // 2. Concurrently execute all independent aggregation pipelines
  const [
    activeBranches,
    totalReports,
    auditsThisWeek,
    openIssuesAgg,
    totalVisitsAgg,
    branchVisitFrequency,
    trendAgg,
    issuesAgg,
    recentReports,
  ] = await Promise.all([
    // Active branches count
    Branch.countDocuments({ user: userId, isArchived: false }),

    // Total active reports count
    Report.countDocuments({ user: userId, isArchived: false }),

    // Reports created or dated in trailing 7 days
    Report.countDocuments({ user: userId, isArchived: false, date: { $gte: sevenDaysAgo } }),

    // Open issues count (reported or in_progress)
    Report.aggregate([
      { $match: { user: userId, isArchived: false } },
      { $unwind: '$issues' },
      { $match: { 'issues.status': { $in: ['reported', 'in_progress'] } } },
      { $count: 'count' },
    ]),

    // Total visits across all active reports
    Report.aggregate([
      { $match: { user: userId, isArchived: false } },
      { $project: { visitCount: { $size: { $ifNull: ['$visits', []] } } } },
      { $group: { _id: null, total: { $sum: '$visitCount' } } },
    ]),

    // Top 10 visited branches with populated code and name
    Report.aggregate([
      { $match: { user: userId, isArchived: false } },
      { $unwind: '$visits' },
      {
        $group: {
          _id: '$visits.branch',
          visitCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branchDoc',
        },
      },
      { $unwind: { path: '$branchDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          branchId: '$_id',
          branchName: { $ifNull: ['$branchDoc.name', 'Unknown Branch'] },
          branchCode: { $ifNull: ['$branchDoc.code', 'UNK'] },
          visitCount: 1,
        },
      },
      { $sort: { visitCount: -1 } },
      { $limit: 10 },
    ]),

    // Trailing 14-day audit volume aggregation
    Report.aggregate([
      {
        $match: {
          user: userId,
          isArchived: false,
          date: { $gte: fourteenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 },
        },
      },
    ]),

    // Recurring issues breakdown by status
    Report.aggregate([
      { $match: { user: userId, isArchived: false } },
      { $unwind: '$issues' },
      {
        $group: {
          _id: '$issues.status',
          count: { $sum: 1 },
        },
      },
    ]),

    // Recent 5 operational reports
    Report.find({ user: userId, isArchived: false })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .populate('visits.branch', 'name code')
      .select('date ethiopianDate shiftSchedule visits issues activities')
      .lean(),
  ]);

  // 3. Extract scalar aggregations
  const openIssues = openIssuesAgg.length > 0 ? openIssuesAgg[0].count : 0;
  const totalVisits = totalVisitsAgg.length > 0 ? totalVisitsAgg[0].total : 0;

  // 4. Construct normalized, continuous 14-day timeline (zero gaps)
  const trendMap = new Map();
  trendAgg.forEach((item) => {
    if (item._id) {
      trendMap.set(item._id, item.count);
    }
  });

  const auditVolumeTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

    auditVolumeTrend.push({
      date: dateStr,
      label,
      count: trendMap.get(dateStr) || 0,
    });
  }

  // 5. Construct recurring issues status counts
  const recurringIssues = {
    reported: 0,
    in_progress: 0,
    completed: 0,
    no_issue: 0,
  };
  issuesAgg.forEach((item) => {
    if (item._id && recurringIssues[item._id] !== undefined) {
      recurringIssues[item._id] = item.count;
    }
  });

  // 6. Return response in standard platform envelope
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Dashboard metrics retrieved successfully.',
    data: {
      kpis: {
        activeBranches,
        totalReports,
        auditsThisWeek,
        openIssues,
        totalVisits,
      },
      branchVisitFrequency,
      auditVolumeTrend,
      recurringIssues,
      recentReports,
    },
  });
});

export default {
  getDashboardMetrics,
};
