import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createItem, deleteItem, getItem, getItemMatches, listItems, updateItem } from '../controllers/itemController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateItemImages } from '../middleware/itemImageUpload.js';
import { MATCH_CONFIG } from '../services/matchingConfig.js';
import { createClaim, listItemClaims } from '../controllers/claimController.js';

const router = Router();
const matchingGenerationLimit = rateLimit({
  windowMs: MATCH_CONFIG.generationWindowMs,
  limit: MATCH_CONFIG.generationLimit,
  keyGenerator: (req) => req.user.id || req.user._id.toString(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(req, _res, next) { req.matchingRateLimited = true; next(); },
});
const itemWriteLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user.id || req.user._id.toString(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', code: 'ITEM_WRITE_RATE_LIMITED', message: 'You have made several listing changes recently. Please try again later.' }),
});
const claimSubmissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user.id || req.user._id.toString(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_req, res) { res.status(429).json({ status: 'error', code: 'CLAIM_RATE_LIMITED', message: 'You have submitted several claims recently. Please try again later.' }); },
});
router.use(requireAuth);
router.route('/').post(itemWriteLimit, matchingGenerationLimit, validateItemImages, createItem).get(listItems);
router.route('/:itemId/claims').get(listItemClaims).post(claimSubmissionLimit, createClaim);
router.get('/:id/matches', getItemMatches);
router.route('/:id').get(getItem).put(itemWriteLimit, matchingGenerationLimit, validateItemImages, updateItem).delete(deleteItem);

export default router;
