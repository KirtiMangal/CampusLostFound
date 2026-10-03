import { Router } from 'express';
import { adminReportDetails, adminReports, adminUsers, analyticsCategories, analyticsLocations, analyticsOverview, analyticsTrends, moderateAdminItem, reviewAdminReport, suspendAdminUser, unsuspendAdminUser } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();
router.use(requireAuth, requireRole('admin'));
const moderationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
const userActionLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
router.get('/reports', adminReports);
router.get('/reports/:reportId', adminReportDetails);
router.patch('/reports/:reportId/review', moderationLimit, reviewAdminReport);
router.patch('/items/:itemId/moderation', moderationLimit, moderateAdminItem);
router.get('/users', adminUsers);
router.patch('/users/:userId/suspend', userActionLimit, suspendAdminUser);
router.patch('/users/:userId/unsuspend', userActionLimit, unsuspendAdminUser);
router.get('/analytics/overview', analyticsOverview);
router.get('/analytics/trends', analyticsTrends);
router.get('/analytics/categories', analyticsCategories);
router.get('/analytics/locations', analyticsLocations);

export default router;
