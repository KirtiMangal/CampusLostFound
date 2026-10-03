import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateDistanceDays, dateProximityScore, locationSimilarity, scoreHeuristic, textSimilarity } from '../src/services/heuristicMatchingService.js';

const base = { type: 'lost', title: 'Blue water bottle', description: 'steel bottle with mountain sticker', category: 'Accessories', location: 'North Library', date: '2026-10-01' };

test('heuristic scoring is deterministic, bounded, and separates opposite item types', () => {
  const exact = scoreHeuristic(base, { ...base, type: 'found' });
  assert.deepEqual(exact, scoreHeuristic(base, { ...base, type: 'found' }));
  assert.equal(exact.eligible, true);
  assert.equal(exact.score, 100);
  assert.equal(scoreHeuristic(base, { ...base }).eligible, false);
  assert.equal(scoreHeuristic(base, { ...base, type: 'unknown' }).eligible, false);
});

test('category and location overlap have sensible exact, partial, and unrelated scores', () => {
  assert.equal(scoreHeuristic(base, { ...base, type: 'found' }).breakdown.category, 25);
  assert.equal(scoreHeuristic(base, { ...base, type: 'found', category: 'Electronics' }).breakdown.category, 0);
  assert.equal(locationSimilarity('North Library', 'Library north entrance').score, 1);
  assert.ok(locationSimilarity('North Library', 'Library entrance').score > 0);
  assert.equal(locationSimilarity('North Library', 'South Cafeteria').score, 0);
});

test('dates reward close reports and treat distant dates as weak evidence', () => {
  assert.equal(dateDistanceDays('2026-10-01', '2026-10-01'), 0);
  assert.equal(dateProximityScore(0), 25);
  assert.equal(dateProximityScore(1), 22);
  assert.equal(dateProximityScore(4), 8);
  assert.equal(dateProximityScore(30), 0);
  assert.equal(dateDistanceDays('invalid', '2026-10-01'), null);
});

test('text overlap distinguishes identical, partial, and unrelated descriptions', () => {
  const same = textSimilarity(base, { ...base, type: 'found' });
  const partial = textSimilarity(base, { title: 'Blue bottle', description: 'found near library', type: 'found' });
  const unrelated = textSimilarity(base, { title: 'Calculator', description: 'silver calculator with cracked screen', type: 'found' });
  assert.equal(same.score, 1);
  assert.ok(partial.score > 0 && partial.score < 1);
  assert.equal(unrelated.score, 0);
});
