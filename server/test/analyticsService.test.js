import assert from 'node:assert/strict';
import { test } from 'node:test';
import Item from '../src/models/Item.js';
import Claim from '../src/models/Claim.js';
import { analyticsInternals, getAnalyticsOverview, getAnalyticsTrends, getCategoryDistribution, getTopLostLocations } from '../src/services/analyticsService.js';
import { ITEM_CATEGORIES } from '../../shared/itemConstants.js';

test('overview totals and recovery rate are calculated from aggregated counts', async (t) => {
  t.mock.method(Item, 'aggregate', async () => [
    { _id: { type: 'lost', status: 'active' }, count: 6 },
    { _id: { type: 'lost', status: 'resolved' }, count: 2 },
    { _id: { type: 'found', status: 'active' }, count: 3 },
    { _id: { type: 'found', status: 'resolved' }, count: 1 },
  ]);
  t.mock.method(Claim, 'aggregate', async () => [{ _id: 'pending', count: 2 }, { _id: 'approved', count: 3 }, { _id: 'rejected', count: 1 }]);
  assert.deepEqual(await getAnalyticsOverview(), { totalItems: 12, activeItems: 9, resolvedItems: 3, lostItems: 8, foundItems: 4, resolvedLostItems: 2, totalClaims: 6, approvedClaims: 3, pendingClaims: 2, recoveryRate: 25 });
});

test('empty overview handles zero denominators safely', async (t) => {
  t.mock.method(Item, 'aggregate', async () => []);
  t.mock.method(Claim, 'aggregate', async () => []);
  const overview = await getAnalyticsOverview();
  assert.equal(overview.recoveryRate, 0);
  assert.equal(overview.totalItems, 0);
  assert.equal(overview.pendingClaims, 0);
});

test('8-week UTC trend includes zero-activity weeks and compares current and previous four-week periods', async (t) => {
  const pipelines = [];
  t.mock.method(Item, 'aggregate', async (pipeline) => {
    pipelines.push(pipeline);
    if (pipelines.length === 1) return [
      { _id: { week: new Date('2026-08-10T00:00:00Z'), type: 'lost' }, count: 1 },
      { _id: { week: new Date('2026-09-28T00:00:00Z'), type: 'found' }, count: 4 },
    ];
    return [{ _id: new Date('2026-09-28T00:00:00Z'), count: 2 }];
  });
  const result = await getAnalyticsTrends(new Date('2026-10-03T12:00:00Z'));
  assert.equal(result.weeks.length, 8);
  assert.equal(result.weeks[0].week, '2026-08-10');
  assert.equal(result.weeks[0].lost, 1);
  assert.equal(result.weeks[1].found, 0);
  assert.equal(result.weeks[7].found, 4);
  assert.equal(result.weeks[7].resolved, 2);
  assert.deepEqual(result.comparison, { current4WeekTotal: 4, previous4WeekTotal: 1, percentageChange: 300, current4WeekResolved: 2, previous4WeekResolved: 0, resolvedPercentageChange: null });
  assert.equal(result.timezone, 'UTC');
  assert.equal(pipelines[0][1].$group._id.week.$dateTrunc.startOfWeek, 'monday');
  assert.equal(pipelines[0][1].$group._id.week.$dateTrunc.timezone, 'UTC');
});

test('category distribution uses shared categories and fills categories with zero', async (t) => {
  t.mock.method(Item, 'aggregate', async () => [{ _id: 'Books', count: 3 }, { _id: 'Keys', count: 2 }]);
  const categories = await getCategoryDistribution();
  assert.deepEqual(categories.map((entry) => entry.category), ITEM_CATEGORIES);
  assert.equal(categories.find((entry) => entry.category === 'Books').count, 3);
  assert.equal(categories.find((entry) => entry.category === 'Electronics').count, 0);
});

test('lost location aggregation trims and case-normalizes values; date helpers handle zero comparisons', async (t) => {
  let pipeline;
  t.mock.method(Item, 'aggregate', async (value) => { pipeline = value; return [{ location: 'Library', count: 5 }]; });
  assert.deepEqual(await getTopLostLocations(), [{ location: 'Library', count: 5 }]);
  assert.equal(pipeline[1].$group._id.$toLower.$trim.input, '$location');
  assert.equal(analyticsInternals.changePercent(0, 0), 0);
  assert.equal(analyticsInternals.changePercent(1, 0), null);
});
