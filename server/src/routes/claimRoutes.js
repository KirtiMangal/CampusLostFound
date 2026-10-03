import { Router } from 'express';
import { approve, cancel, claimContact, claimDetails, myClaims, receivedClaims, reject } from '../controllers/claimController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/mine', myClaims);
router.get('/received', receivedClaims);
router.get('/:claimId/contact', claimContact);
router.patch('/:claimId/approve', approve);
router.patch('/:claimId/reject', reject);
router.patch('/:claimId/cancel', cancel);
router.get('/:claimId', claimDetails);

export default router;
