import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  sourceItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  candidateItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  itemPairKey: { type: String, required: true, unique: true },
  heuristicScore: { type: Number, min: 0, max: 100, required: true },
  heuristicBreakdown: { category: Number, location: Number, date: Number, text: Number },
  geminiConfidence: { type: Number, min: 0, max: 100, default: null },
  geminiDecision: { type: String, enum: ['possible_match', 'unlikely_match', 'insufficient_information', null], default: null },
  geminiReasoning: { type: [String], default: [] },
  matchingSignals: { type: [String], default: [] },
  contradictingSignals: { type: [String], default: [] },
  missingInformation: { type: [String], default: [] },
  finalScore: { type: Number, min: 0, max: 100, required: true },
  classification: { type: String, enum: ['strong_candidate', 'possible_candidate', 'weak_candidate', 'unlikely'], required: true },
}, { timestamps: true });

matchSchema.index({ sourceItem: 1, finalScore: -1 });
matchSchema.index({ candidateItem: 1, finalScore: -1 });

export default mongoose.models.Match || mongoose.model('Match', matchSchema);
