import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', required: true },
  claimMessage: { type: String, required: true, trim: true, maxlength: 2000 },
  rejectionReason: { type: String, trim: true, maxlength: 300, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Rejected and cancelled requests remain as history; either can be resubmitted.
claimSchema.index({ item: 1, claimant: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
claimSchema.index({ itemOwner: 1, status: 1, createdAt: -1 });
claimSchema.index({ claimant: 1, createdAt: -1 });

export default mongoose.models.Claim || mongoose.model('Claim', claimSchema);
