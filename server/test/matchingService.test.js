import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Item from '../src/models/Item.js';
import Match from '../src/models/Match.js';
import { generateMatchesForItem } from '../src/services/matchingService.js';
import { setGeminiClientFactoryForTests } from '../src/services/geminiService.js';

process.env.GEMINI_API_KEY = 'test-gemini-key';
const sourceId = '64b000000000000000000041';
const source = { _id: new mongoose.Types.ObjectId(sourceId), type: 'lost', title: 'Blue water bottle', description: 'steel bottle with sticker', category: 'Accessories', location: 'North Library', date: '2026-10-01', status: 'active' };
const aiResult = { confidence: 90, decision: 'possible_match', reasoning: ['Shared details.'], matchingSignals: ['Blue bottle'], contradictingSignals: [], missingInformation: [] };

function candidate(index, overrides = {}) {
  return { _id: new mongoose.Types.ObjectId(`64b0000000000000000000${String(50 + index).padStart(2, '0')}`), type: 'found', title: 'Blue water bottle', description: 'steel bottle with sticker', category: 'Accessories', location: 'North Library', date: '2026-10-01', status: 'active', ...overrides };
}

function setup(t, candidates, { existing = [], failGemini = false } = {}) {
  let capturedFilter;
  let poolLimit;
  const saved = [];
  const deleted = [];
  t.mock.method(Item, 'findById', () => ({ lean: async () => source }));
  t.mock.method(Item, 'find', (filter) => {
    capturedFilter = filter;
    const query = { select: () => query, sort: () => query, limit: (value) => { poolLimit = value; return query; }, lean: async () => candidates };
    return query;
  });
  t.mock.method(Match, 'find', () => ({ lean: async () => existing }));
  t.mock.method(Match, 'findOneAndUpdate', (filter, update) => {
    const record = { _id: new mongoose.Types.ObjectId(), ...update.$set };
    saved.push({ filter, record });
    return { lean: async () => record };
  });
  t.mock.method(Match, 'deleteMany', async (filter) => { deleted.push(filter); return { deletedCount: 0 }; });
  let aiCalls = 0;
  const restore = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => {
    aiCalls += 1;
    if (failGemini) throw new Error('provider unavailable');
    return { text: JSON.stringify(aiResult) };
  } } }));
  t.after(restore);
  return { saved, deleted, get aiCalls() { return aiCalls; }, get filter() { return capturedFilter; }, get poolLimit() { return poolLimit; } };
}

test('filters opposite active types, excludes source, bounds Gemini calls, and saves ranked results', async (t) => {
  const candidates = Array.from({ length: 11 }, (_, index) => candidate(index));
  const state = setup(t, candidates);
  const matches = await generateMatchesForItem(sourceId);
  assert.equal(state.filter.type, 'found');
  assert.equal(state.filter.status, 'active');
  assert.equal(state.filter._id.$ne.toString(), sourceId);
  assert.equal(state.poolLimit, 200);
  assert.equal(state.aiCalls, 10);
  assert.equal(state.saved.length, 10);
  assert.equal(matches[0].heuristicScore, 100);
  assert.equal(matches[0].finalScore, 94);
  assert.equal(matches[0].classification, 'strong_candidate');
  assert.equal(state.deleted.length, 1);
});

test('supports found-to-lost by deriving the opposite type from the source', async (t) => {
  const foundSource = { ...source, type: 'found' };
  t.mock.method(Item, 'findById', () => ({ lean: async () => foundSource }));
  let filter;
  t.mock.method(Item, 'find', (value) => { filter = value; const q = { select: () => q, sort: () => q, limit: () => q, lean: async () => [] }; return q; });
  t.mock.method(Match, 'deleteMany', async () => ({ deletedCount: 0 }));
  assert.deepEqual(await generateMatchesForItem(sourceId), []);
  assert.equal(filter.type, 'lost');
});

test('reuses existing pair results and falls back to heuristic evidence when Gemini fails', async (t) => {
  const found = candidate(1);
  const existing = { itemPairKey: [sourceId, found._id.toString()].sort().join(':'), finalScore: 70 };
  const reuseState = setup(t, [found], { existing: [existing] });
  const reused = await generateMatchesForItem(sourceId);
  assert.deepEqual(reused, [existing]);
  assert.equal(reuseState.aiCalls, 0);
  assert.equal(reuseState.saved.length, 0);

  const fallbackState = setup(t, [found], { failGemini: true });
  const fallback = await generateMatchesForItem(sourceId);
  assert.equal(fallbackState.saved.length, 1);
  assert.equal(fallback[0].geminiConfidence, null);
  assert.equal(fallback[0].finalScore, fallback[0].heuristicScore);
  assert.ok(fallback[0].matchingSignals.length);
});

test('removes stale matches and does not query candidates for inactive items', async (t) => {
  const inactive = { ...source, status: 'resolved' };
  t.mock.method(Item, 'findById', () => ({ lean: async () => inactive }));
  t.mock.method(Item, 'find', () => assert.fail('inactive source should not query candidates'));
  let deleted;
  t.mock.method(Match, 'deleteMany', async (filter) => { deleted = filter; return { deletedCount: 1 }; });
  assert.deepEqual(await generateMatchesForItem(sourceId), []);
  assert.ok(deleted.$or);
});
