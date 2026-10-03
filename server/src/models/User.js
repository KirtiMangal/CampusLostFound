import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student', required: true },
  isActive: { type: Boolean, default: true },
  suspendedAt: { type: Date, default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspensionReason: { type: String, trim: true, maxlength: 500, default: '' },
  suspensionHistory: { type: [{ action: { type: String, enum: ['suspended', 'unsuspended'], required: true }, reason: { type: String, trim: true, maxlength: 500, default: '' }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, at: { type: Date, required: true } }], default: [] },
}, { timestamps: true });

userSchema.index({ isActive: 1, role: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
