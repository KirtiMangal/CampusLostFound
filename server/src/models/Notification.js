import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = Object.freeze(['MATCH_FOUND', 'CLAIM_RECEIVED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_CANCELLED', 'ITEM_RESOLVED', 'MODERATION_REPORT', 'ACCOUNT_REACTIVATED']);

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  relatedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  relatedMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
  relatedClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
  relatedReport: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  dedupeKey: { type: String, trim: true, maxlength: 240, select: false },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
