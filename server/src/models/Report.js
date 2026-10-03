import mongoose from 'mongoose';

export const REPORT_TARGET_TYPES = Object.freeze(['item', 'user', 'claim']);
export const REPORT_REASONS = Object.freeze(['spam', 'fake_information', 'harassment', 'inappropriate_content', 'fraudulent_claim', 'duplicate_listing', 'other']);
export const REPORT_STATUSES = Object.freeze(['pending', 'under_review', 'resolved', 'dismissed']);
export const REPORT_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
  targetItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', default: null },
  reason: { type: String, enum: REPORT_REASONS, required: true },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: REPORT_STATUSES, default: 'pending', required: true },
  priority: { type: String, enum: REPORT_PRIORITIES, default: 'medium', required: true },
  priorityRank: { type: Number, default: 1, select: false },
  activeDuplicateKey: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  resolutionNote: { type: String, trim: true, maxlength: 1000, default: '' },
  autoFlagged: { type: Boolean, default: false },
  moderationScore: { type: Number, min: 0, max: 100, default: 0 },
  flagSignals: { type: [String], default: [] },
  reviewHistory: { type: [{ status: { type: String, enum: REPORT_STATUSES, required: true }, priority: { type: String, enum: REPORT_PRIORITIES, required: true }, note: { type: String, trim: true, maxlength: 1000, default: '' }, itemAction: { type: String, enum: ['hide', 'unhide', null], default: null }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, at: { type: Date, required: true } }], default: [] },
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ priorityRank: -1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetItem: 1 });
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetUser: 1 });
reportSchema.index({ targetType: 1, targetClaim: 1 });
// A reporter may not keep several concurrently actionable reports open for one target.
reportSchema.index({ activeDuplicateKey: 1 }, { unique: true, sparse: true });
reportSchema.pre('validate', function setPriorityRank(next) {
  this.priorityRank = this.priority === 'high' ? 2 : this.priority === 'low' ? 0 : 1;
  next();
});

export default mongoose.models.Report || mongoose.model('Report', reportSchema);
