import mongoose from 'mongoose';
import { ITEM_CATEGORIES, ITEM_STATUSES, ITEM_TYPES } from '../../../shared/itemConstants.js';

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, enum: ITEM_CATEGORIES },
  type: { type: String, required: true, enum: ITEM_TYPES },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: Date, required: true },
  status: { type: String, required: true, enum: ITEM_STATUSES, default: 'active' },
  resolvedByClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null, select: false },
  resolvedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false, index: true },
  hiddenAt: { type: Date, default: null },
  hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  hiddenReason: { type: String, enum: ['ADMIN_MODERATION', 'ACCOUNT_SUSPENDED', null], default: null },
  hiddenBySuspension: { type: Boolean, default: false, select: false },
  moderationHistory: { type: [{ action: { type: String, enum: ['hidden', 'restored'], required: true }, reason: { type: String, enum: ['ADMIN_MODERATION', 'ACCOUNT_SUSPENDED', 'ADMIN_RESTORED', 'ACCOUNT_RESTORED'], required: true }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, at: { type: Date, required: true } }], default: [] },
  // Mixed preserves compatibility with any legacy URL-only image values while
  // newly written images are restricted to { url, publicId } by the service.
  images: { type: [mongoose.Schema.Types.Mixed], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, optimisticConcurrency: true });

itemSchema.index({ title: 'text', description: 'text', location: 'text' });
itemSchema.index({ type: 1, status: 1, date: -1 });
itemSchema.index({ category: 1 });
itemSchema.index({ location: 1 });
itemSchema.index({ owner: 1, createdAt: -1 });
itemSchema.index({ createdAt: 1, type: 1 });
itemSchema.index({ status: 1, updatedAt: 1 });
itemSchema.index({ status: 1, resolvedAt: 1 });

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
export default Item;
