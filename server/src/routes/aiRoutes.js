import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { describeItemController } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
const describeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id || req.user._id.toString(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({ status: 'error', code: 'AI_RATE_LIMITED', message: 'You’ve reached the AI assistance limit. Please try again in 15 minutes.' });
  },
});

router.use(requireAuth);
router.post('/describe', describeRateLimit, describeItemController);

export default router;
