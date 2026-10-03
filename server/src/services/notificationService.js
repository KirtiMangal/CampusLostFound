import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import AppError from '../utils/AppError.js';
import { notificationInputSchema } from '../validators/notificationValidator.js';

const id = (value) => value?._id?.toString?.() || value?.toString?.() || '';
function safeNotification(notification) {
  return {
    id: id(notification._id), type: notification.type, title: notification.title, message: notification.message,
    relatedItem: id(notification.relatedItem) || null, relatedMatch: id(notification.relatedMatch) || null,
    relatedClaim: id(notification.relatedClaim) || null, relatedReport: id(notification.relatedReport) || null, isRead: notification.isRead,
    createdAt: notification.createdAt, updatedAt: notification.updatedAt,
  };
}
function validateId(value) {
  if (!mongoose.isValidObjectId(value)) throw new AppError('Invalid notification ID.', 400, 'INVALID_NOTIFICATION_ID');
}

export async function createNotification(input) {
  const result = notificationInputSchema.safeParse(input);
  if (!result.success) throw new AppError('Notification data is invalid.', 400, 'NOTIFICATION_INVALID', result.error.flatten());
  const data = result.data;
  if (data.actorId && data.actorId === data.recipient) return null;
  if (data.dedupeKey) {
    const previous = await Notification.findOne({ dedupeKey: data.dedupeKey }).select('_id').lean();
    if (previous) return null;
  }
  try {
    const notification = await Notification.create({
      recipient: data.recipient, type: data.type, title: data.title, message: data.message,
      relatedItem: data.relatedItem || null, relatedMatch: data.relatedMatch || null, relatedClaim: data.relatedClaim || null, relatedReport: data.relatedReport || null,
      dedupeKey: data.dedupeKey,
    });
    return safeNotification(notification);
  } catch (error) {
    if (error?.code === 11000 && data.dedupeKey) return null;
    throw error;
  }
}

export async function createNotifications(inputs) {
  if (mongoose.connection.readyState !== 1) return 0;
  const outcomes = await Promise.allSettled(inputs.map((input) => createNotification(input)));
  for (const outcome of outcomes) if (outcome.status === 'rejected') console.warn('Notification creation failed:', { name: outcome.reason?.name || 'Error', code: outcome.reason?.code });
  return outcomes.filter((outcome) => outcome.status === 'fulfilled' && outcome.value).length;
}

export async function getUserNotifications(userId, query) {
  const filter = { recipient: userId };
  if (query.unread !== undefined) filter.isRead = !query.unread;
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { success: true, data: notifications.map(safeNotification), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export function getUnreadNotificationCount(userId) {
  return Notification.countDocuments({ recipient: userId, isRead: false });
}

export async function markNotificationAsRead(notificationId, userId) {
  validateId(notificationId);
  const notification = await Notification.findOneAndUpdate({ _id: notificationId, recipient: userId }, { $set: { isRead: true } }, { new: true }).lean();
  if (!notification) throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  return { success: true, data: safeNotification(notification) };
}

export async function markAllNotificationsAsRead(userId) {
  const result = await Notification.updateMany({ recipient: userId, isRead: false }, { $set: { isRead: true } });
  return { success: true, data: { modifiedCount: result.modifiedCount } };
}

export async function deleteNotification(notificationId, userId) {
  validateId(notificationId);
  const notification = await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  if (!notification) throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
  return { success: true, message: 'Notification deleted.' };
}
