import { Router } from 'express';
import { listNotifications, markAllRead, markOneRead, removeNotification, unreadCount } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllRead);
router.get('/', listNotifications);
router.patch('/:notificationId/read', markOneRead);
router.delete('/:notificationId', removeNotification);

export default router;
