import mongoose from 'mongoose';

const adminMutationLockSchema = new mongoose.Schema({
  _id: { type: String },
  leaseUntil: { type: Date, required: true },
  token: { type: String, default: null },
}, { versionKey: false, timestamps: false });

export default mongoose.models.AdminMutationLock || mongoose.model('AdminMutationLock', adminMutationLockSchema);
