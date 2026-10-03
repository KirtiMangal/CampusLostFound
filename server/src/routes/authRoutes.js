import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', code: 'LOGIN_RATE_LIMITED', message: 'Too many sign-in attempts. Please try again in 15 minutes.' }),
});
const registrationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', code: 'REGISTRATION_RATE_LIMITED', message: 'Too many accounts were created from this connection. Please try again later.' }),
});
router.post('/register', registrationLimit, register);
router.post('/login', loginLimit, login);
router.get('/me', requireAuth, me);

export default router;
