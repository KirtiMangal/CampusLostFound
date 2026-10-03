import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import AppError from '../utils/AppError.js';
import { MATCH_CLASSIFICATION_THRESHOLDS as THRESHOLDS, MATCH_CONFIG } from './matchingConfig.js';
import { scoreHeuristic } from './heuristicMatchingService.js';
import { evaluateMatch } from './geminiMatchingService.js';
import { createNotifications } from './notificationService.js';

const fields = 'title description type category location date status images owner';
const publicMatchFields = 'title description type category location date images status';
const id = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const pairKey = (a, b) => [id(a), id(b)].sort().join(':');

async function notifyMatchOwners(match, source, candidate) {
  if (match.finalScore < 60 || !match._id) return;
  const recipients = new Map();
  if (source.owner) recipients.set(id(source.owner), source._id);
  if (candidate.owner && !recipients.has(id(candidate.owner))) recipients.set(id(candidate.owner), candidate._id);
  await createNotifications([...recipients].filter(([recipient]) => recipient).map(([recipient, relatedItem]) => ({
    recipient, type: 'MATCH_FOUND', title: 'A possible match was found',
    message: 'A possible match was found for your report. Review the details; matches do not confirm ownership.',
    relatedItem: id(relatedItem), relatedMatch: id(match._id), dedupeKey: `match:${id(match._id)}:${recipient}`,
  })));
}

export function classifyMatch(score) {
  if (score >= THRESHOLDS.strong) return 'strong_candidate';
  if (score >= THRESHOLDS.possible) return 'possible_candidate';
  if (score >= THRESHOLDS.weak) return 'weak_candidate';
  return 'unlikely';
}

export async function generateMatchesForItem(itemId, { force = false } = {}) {
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid item ID.', 400, 'INVALID_ITEM_ID');
  const source = await Item.findById(itemId).lean();
  if (!source) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  if (source.status !== 'active' || source.isHidden) {
    if (source.status !== 'active') await Match.deleteMany({ $or: [{ sourceItem: source._id }, { candidateItem: source._id }] });
    return [];
  }

  const candidates = await Item.find({ type: source.type === 'lost' ? 'found' : 'lost', status: 'active', isHidden: { $ne: true }, _id: { $ne: source._id } })
    .select(fields).sort({ date: -1 }).limit(MATCH_CONFIG.candidatePoolLimit).lean();
  const ranked = candidates.map((candidate) => ({ candidate, heuristic: scoreHeuristic(source, candidate) }))
    .filter(({ heuristic }) => heuristic.eligible && heuristic.score >= MATCH_CONFIG.heuristicThreshold)
    .sort((a, b) => b.heuristic.score - a.heuristic.score || id(a.candidate).localeCompare(id(b.candidate)))
    .slice(0, MATCH_CONFIG.candidateLimit);
  const keys = ranked.map(({ candidate }) => pairKey(source._id, candidate._id));
  const existing = force || !keys.length ? [] : await Match.find({ itemPairKey: { $in: keys } }).lean();
  const byKey = new Map(existing.map((match) => [match.itemPairKey, match]));
  const results = [];
  for (const { candidate, heuristic } of ranked) {
    const key = pairKey(source._id, candidate._id);
    if (byKey.has(key)) {
      const reused = byKey.get(key);
      await notifyMatchOwners(reused, source, candidate);
      results.push(reused);
      continue;
    }
    let ai = null;
    try { ai = await evaluateMatch(source, candidate); }
    catch (error) { console.warn('Match AI assessment unavailable; retaining heuristic score:', { name: error?.name || 'Error', code: error?.code }); }
    const weights = MATCH_CONFIG.heuristicWeight + MATCH_CONFIG.geminiWeight;
    const finalScore = ai && weights > 0
      ? Math.round((heuristic.score * MATCH_CONFIG.heuristicWeight + ai.confidence * MATCH_CONFIG.geminiWeight) / weights)
      : heuristic.score;
    const doc = {
      sourceItem: source._id, candidateItem: candidate._id, itemPairKey: key,
      heuristicScore: heuristic.score, heuristicBreakdown: heuristic.breakdown,
      geminiConfidence: ai?.confidence ?? null, geminiDecision: ai?.decision ?? null,
      geminiReasoning: ai?.reasoning ?? [], matchingSignals: [...new Set([...heuristic.signals, ...(ai?.matchingSignals ?? [])])],
      contradictingSignals: ai?.contradictingSignals ?? [], missingInformation: ai?.missingInformation ?? [],
      finalScore, classification: classifyMatch(finalScore),
    };
    const match = await Match.findOneAndUpdate({ itemPairKey: key }, { $set: doc }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    await notifyMatchOwners(match, source, candidate);
    results.push(match);
  }
  await Match.deleteMany({ $or: [{ sourceItem: source._id }, { candidateItem: source._id }], itemPairKey: { $nin: keys } });
  return results;
}

export function scheduleMatchGeneration(itemId, options = {}) {
  if (mongoose.connection.readyState !== 1) return;
  setImmediate(() => { void generateMatchesForItem(itemId, options).catch((error) => console.warn('Background matching failed:', { name: error?.name || 'Error', code: error?.code })); });
}

export async function getMatchesForItem(itemId, user) {
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Invalid item ID.', 400, 'INVALID_ITEM_ID');
  const item = await Item.findById(itemId).select('_id owner isHidden').lean();
  if (!item) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  if (user.role !== 'admin' && id(item.owner) !== id(user)) throw new AppError('You can only view matches for your own reports.', 403, 'FORBIDDEN');
  if (item.isHidden && user.role !== 'admin') return { success: true, data: [] };
  const matches = await Match.find({ $or: [{ sourceItem: item._id }, { candidateItem: item._id }], finalScore: { $gte: THRESHOLDS.weak } })
    .populate('sourceItem', `${publicMatchFields} isHidden`).populate('candidateItem', `${publicMatchFields} isHidden`).sort({ finalScore: -1, updatedAt: -1 }).lean();
  return { success: true, data: matches.filter((match) => {
    const related = id(match.sourceItem) === id(item._id) ? match.candidateItem : match.sourceItem;
    return related && (user.role === 'admin' || related.isHidden !== true);
  }).map((match) => {
    const related = id(match.sourceItem) === id(item._id) ? match.candidateItem : match.sourceItem;
    const images = (related.images || []).map((image) => typeof image === 'string' ? image : image?.url).filter(Boolean).map((url) => ({ url }));
    return { matchId: id(match._id), item: { id: id(related._id), title: related.title, description: related.description, type: related.type, category: related.category, location: related.location, date: related.date instanceof Date ? related.date.toISOString().slice(0, 10) : String(related.date).slice(0, 10), images }, finalScore: match.finalScore, classification: match.classification, matchingSignals: match.matchingSignals || [] };
  }) };
}
