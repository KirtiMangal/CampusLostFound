import asyncHandler from '../utils/asyncHandler.js';
import { getAnalyticsOverview, getAnalyticsTrends, getCategoryDistribution, getTopLostLocations } from '../services/analyticsService.js';
import { getReportDetails, listAdminUsers, listReports, moderateItem, reviewReport, suspendUser, unsuspendUser } from '../services/moderationService.js';
import AppError from '../utils/AppError.js';
import { itemModerationSchema, reportIdSchema, reportListQuerySchema, reviewReportSchema, suspensionSchema, userIdSchema, userListQuerySchema } from '../validators/reportValidator.js';

function parse(schema, input, code) {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('Please check the moderation request.', 400, code, result.error.flatten());
  return result.data;
}

export const analyticsOverview = asyncHandler(async (_req, res) => res.json({ success: true, data: await getAnalyticsOverview() }));
export const analyticsTrends = asyncHandler(async (_req, res) => res.json({ success: true, data: await getAnalyticsTrends() }));
export const analyticsCategories = asyncHandler(async (_req, res) => res.json({ success: true, data: await getCategoryDistribution() }));
export const analyticsLocations = asyncHandler(async (_req, res) => res.json({ success: true, data: await getTopLostLocations() }));
export const adminReports = asyncHandler(async (req, res) => res.json(await listReports(parse(reportListQuerySchema, req.query, 'REPORT_QUERY_INVALID'))));
export const adminReportDetails = asyncHandler(async (req, res) => res.json(await getReportDetails(parse(reportIdSchema, req.params.reportId, 'INVALID_REPORT_ID'))));
export const reviewAdminReport = asyncHandler(async (req, res) => res.json(await reviewReport(parse(reportIdSchema, req.params.reportId, 'INVALID_REPORT_ID'), req.user._id, parse(reviewReportSchema, req.body, 'REPORT_REVIEW_INVALID'))));
export const adminUsers = asyncHandler(async (req, res) => res.json(await listAdminUsers(parse(userListQuerySchema, req.query, 'USER_QUERY_INVALID'))));
export const suspendAdminUser = asyncHandler(async (req, res) => {
  const userId = parse(userIdSchema, req.params.userId, 'INVALID_USER_ID');
  const input = parse(suspensionSchema, req.body, 'SUSPENSION_INVALID');
  res.json(await suspendUser(userId, req.user._id, input.reason));
});
export const unsuspendAdminUser = asyncHandler(async (req, res) => res.json(await unsuspendUser(parse(userIdSchema, req.params.userId, 'INVALID_USER_ID'), req.user._id)));
export const moderateAdminItem = asyncHandler(async (req, res) => {
  const itemId = parse(userIdSchema, req.params.itemId, 'INVALID_ITEM_ID');
  const body = parse(itemModerationSchema, req.body, 'ITEM_MODERATION_INVALID');
  await moderateItem(itemId, body.action, req.user._id);
  res.json({ success: true, data: { id: itemId, isHidden: body.action === 'hide' } });
});
