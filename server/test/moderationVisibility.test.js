import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Item from '../src/models/Item.js';
import Claim from '../src/models/Claim.js';
import Match from '../src/models/Match.js';
import { approveClaim, createClaim } from '../src/services/claimService.js';
import { getItem, listItems } from '../src/services/itemService.js';
import { getMatchesForItem } from '../src/services/matchingService.js';

const ITEM = '64b0000000000000000000e1';
const OWNER = '64b0000000000000000000e2';
const STUDENT = '64b0000000000000000000e3';

test('hidden items are omitted from campus listings and direct reads while admins can inspect them', async (t) => {
  let filter;
  t.mock.method(Item, 'find', (value) => { filter = value; const query = { populate: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => [] }; return query; });
  t.mock.method(Item, 'countDocuments', async () => 0);
  await listItems({ page: 1, limit: 10, mine: false, sort: 'newest' }, { _id: new mongoose.Types.ObjectId(STUDENT), role: 'student' });
  assert.deepEqual(filter.isHidden, { $ne: true });
  await listItems({ page: 1, limit: 10, mine: false, sort: 'newest' }, { _id: new mongoose.Types.ObjectId(STUDENT), role: 'admin' });
  assert.equal('isHidden' in filter, false);

  const hiddenItem = { _id: new mongoose.Types.ObjectId(ITEM), title: 'Wallet', description: 'Blue wallet', category: 'Accessories', type: 'lost', location: 'Library', date: new Date(), status: 'active', isHidden: true, owner: { _id: new mongoose.Types.ObjectId(OWNER), name: 'Owner' }, images: [] };
  t.mock.method(Item, 'findById', () => ({ populate: () => ({ lean: async () => hiddenItem }) }));
  await assert.rejects(() => getItem(ITEM, { id: STUDENT, role: 'student' }), { code: 'ITEM_NOT_FOUND', statusCode: 404 });
  assert.equal((await getItem(ITEM, { _id: new mongoose.Types.ObjectId(OWNER), id: OWNER, role: 'student' })).isHidden, true);
  assert.equal((await getItem(ITEM, { _id: new mongoose.Types.ObjectId(STUDENT), id: STUDENT, role: 'admin' })).isHidden, true);
});

test('hidden found items cannot accept ownership claims', async (t) => {
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER), type: 'found', status: 'active', isHidden: true }) }) }));
  await assert.rejects(() => createClaim(ITEM, { _id: new mongoose.Types.ObjectId(STUDENT), role: 'student' }, { claimMessage: 'Unique inner label.' }), { code: 'ITEM_HIDDEN', statusCode: 409 });
});

test('hidden items cannot approve pending claims and do not expose stored matches to owners', async (t) => {
  const claimId = '64b0000000000000000000e4';
  t.mock.method(Claim, 'findById', () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(claimId), item: new mongoose.Types.ObjectId(ITEM), itemOwner: new mongoose.Types.ObjectId(OWNER), claimant: new mongoose.Types.ObjectId(STUDENT), status: 'pending' }) }));
  let approveFilter;
  t.mock.method(Item, 'findOneAndUpdate', (filter) => { approveFilter = filter; return { lean: async () => null }; });
  await assert.rejects(() => approveClaim(claimId, { _id: new mongoose.Types.ObjectId(OWNER), role: 'student' }), { code: 'ITEM_ALREADY_RESOLVED', statusCode: 409 });
  assert.deepEqual(approveFilter.isHidden, { $ne: true });

  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER), isHidden: true }) }) }));
  t.mock.method(Match, 'find', () => { throw new Error('Hidden item matches must not be read.'); });
  const result = await getMatchesForItem(ITEM, { _id: new mongoose.Types.ObjectId(OWNER), role: 'student' });
  assert.deepEqual(result.data, []);
});
