import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { deleteNotification, getUnreadNotificationCount, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notificationService.js';
import { notificationIdSchema, notificationListQuerySchema } from '../validators/notificationValidator.js';

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('Please check the notification request.', 400, 'NOTIFICATION_QUERY_INVALID', result.error.flatten());
  return result.data;
}
function parseId(value) {
  const result = notificationIdSchema.safeParse(value);
  if (!result.success) throw new AppError('Invalid notification ID.', 400, 'INVALID_NOTIFICATION_ID');
  return result.data;
}

export const listNotifications = asyncHandler(async (req, res) => res.json(await getUserNotifications(req.user._id, parse(notificationListQuerySchema, req.query))));
export const unreadCount = asyncHandler(async (req, res) => res.json({ count: await getUnreadNotificationCount(req.user._id) }));
export const markOneRead = asyncHandler(async (req, res) => res.json(await markNotificationAsRead(parseId(req.params.notificationId), req.user._id)));
export const markAllRead = asyncHandler(async (req, res) => res.json(await markAllNotificationsAsRead(req.user._id)));
export const removeNotification = asyncHandler(async (req, res) => res.json(await deleteNotification(parseId(req.params.notificationId), req.user._id)));
