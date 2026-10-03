import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createReport } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
const reportLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, keyGenerator: (req) => req.user.id || req.user._id.toString(),
  standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', code: 'REPORT_RATE_LIMITED', message: 'You have submitted several reports recently. Please try again later.' }),
});
router.use(requireAuth);
router.post('/', reportLimit, createReport);

export default router;
