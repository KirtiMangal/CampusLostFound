import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Claim from '../src/models/Claim.js';
import Item from '../src/models/Item.js';
import User from '../src/models/User.js';
import { approveClaim, cancelClaim, createClaim, getClaimContact, getClaimDetails, rejectClaim } from '../src/services/claimService.js';

const OWNER_ID = '64b000000000000000000061';
const CLAIMANT_ID = '64b000000000000000000062';
const OTHER_ID = '64b000000000000000000063';
const ITEM_ID = '64b000000000000000000064';
const CLAIM_ID = '64b000000000000000000065';
const OTHER_CLAIM_ID = '64b000000000000000000066';
const user = (value, role = 'student') => ({ _id: new mongoose.Types.ObjectId(value), id: value, role });
const claim = (overrides = {}) => ({ _id: new mongoose.Types.ObjectId(CLAIM_ID), item: new mongoose.Types.ObjectId(ITEM_ID), claimant: new mongoose.Types.ObjectId(CLAIMANT_ID), itemOwner: new mongoose.Types.ObjectId(OWNER_ID), status: 'pending', claimMessage: 'There is a unique keychain attached.', ...overrides });

test('creates only valid pending claims and prevents self, resolved, and duplicate submissions', async (t) => {
  let itemValue = { _id: new mongoose.Types.ObjectId(ITEM_ID), type: 'found', status: 'active', owner: new mongoose.Types.ObjectId(OWNER_ID) };
  let existing = null;
  let created;
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => itemValue }) }));
  t.mock.method(Claim, 'findOne', () => ({ lean: async () => existing }));
  t.mock.method(Claim, 'create', async (data) => { created = { _id: new mongoose.Types.ObjectId(CLAIM_ID), ...data }; return created; });
  const response = await createClaim(ITEM_ID, user(CLAIMANT_ID), { claimMessage: 'Unique keychain attached.' });
  assert.deepEqual(response, { id: CLAIM_ID, status: 'pending' });
  assert.equal(created.itemOwner.toString(), OWNER_ID);
  assert.equal(created.claimMessage, 'Unique keychain attached.');

  await assert.rejects(() => createClaim(ITEM_ID, user(OWNER_ID), { claimMessage: 'Mine' }), { code: 'CANNOT_CLAIM_OWN_ITEM', statusCode: 403 });
  existing = claim();
  await assert.rejects(() => createClaim(ITEM_ID, user(CLAIMANT_ID), { claimMessage: 'Mine again' }), { code: 'DUPLICATE_PENDING_CLAIM', statusCode: 409 });
  existing = null;
  itemValue = { ...itemValue, status: 'resolved' };
  await assert.rejects(() => createClaim(ITEM_ID, user(CLAIMANT_ID), { claimMessage: 'Mine' }), { code: 'ITEM_ALREADY_RESOLVED', statusCode: 409 });
  itemValue = { ...itemValue, status: 'active', type: 'lost' };
  await assert.rejects(() => createClaim(ITEM_ID, user(CLAIMANT_ID), { claimMessage: 'Mine' }), { code: 'CLAIM_REQUIRES_FOUND_ITEM', statusCode: 400 });
});

test('rejects illegal final-state transitions and permits cancellation only by the claimant', async (t) => {
  let current = claim({ status: 'approved' });
  t.mock.method(Claim, 'findById', () => ({ lean: async () => current }));
  await assert.rejects(() => rejectClaim(CLAIM_ID, user(OWNER_ID)), { code: 'CLAIM_NOT_PENDING', statusCode: 409 });
  current = claim({ status: 'pending' });
  await assert.rejects(() => cancelClaim(CLAIM_ID, user(OTHER_ID)), { code: 'FORBIDDEN', statusCode: 403 });
  await assert.rejects(() => cancelClaim(CLAIM_ID, user(OWNER_ID)), { code: 'FORBIDDEN', statusCode: 403 });
  t.mock.method(Claim, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => ({ ...current, status: update.$set.status }) }));
  const cancelled = await cancelClaim(CLAIM_ID, user(CLAIMANT_ID));
  assert.equal(cancelled.data.status, 'cancelled');
});

test('approval resolves the item and rejects all other pending claims', async (t) => {
  const current = claim();
  let itemStatus = 'active';
  let winner;
  let rejectedOthers;
  t.mock.method(Claim, 'findById', () => ({ lean: async () => current }));
  t.mock.method(Item, 'findOneAndUpdate', (filter, update) => ({
    lean: async () => {
      if (filter.status === 'active' && itemStatus === 'active') { itemStatus = update.$set.status; return { status: itemStatus }; }
      if (filter.resolvedByClaim && winner) { itemStatus = update.$set.status; return { status: itemStatus }; }
      return null;
    },
  }));
  t.mock.method(Claim, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => { winner = { ...current, status: update.$set.status, reviewedAt: update.$set.reviewedAt }; return winner; } }));
  t.mock.method(Claim, 'updateMany', async (filter, update) => { rejectedOthers = { filter, update }; return { modifiedCount: 1 }; });
  t.mock.method(Claim, 'find', () => ({ select: () => query, lean: async () => [] }));
  const query = { lean: async () => [] };
  const result = await approveClaim(CLAIM_ID, user(OWNER_ID));
  assert.equal(result.data.status, 'approved');
  assert.equal(itemStatus, 'resolved');
  assert.equal(rejectedOthers.filter.status, 'pending');
  assert.match(rejectedOthers.update.$set.rejectionReason, /already been resolved/);
});

test('owner can reject a pending claim with a bounded reason and cannot review unrelated claims', async (t) => {
  const current = claim();
  let update;
  t.mock.method(Claim, 'findById', () => ({ lean: async () => current }));
  t.mock.method(Claim, 'findOneAndUpdate', (filter, value) => ({ lean: async () => { update = { filter, value }; return { ...current, status: value.$set.status, rejectionReason: value.$set.rejectionReason }; } }));
  await assert.rejects(() => rejectClaim(CLAIM_ID, user(OTHER_ID), 'Not yours'), { code: 'FORBIDDEN', statusCode: 403 });
  const result = await rejectClaim(CLAIM_ID, user(OWNER_ID), 'The marking does not match.');
  assert.equal(result.data.status, 'rejected');
  assert.equal(update.filter.status, 'pending');
  assert.equal(update.value.$set.rejectionReason, 'The marking does not match.');
});

test('only one simultaneous approval can resolve an item', async (t) => {
  let active = true;
  const claims = [claim(), claim({ _id: new mongoose.Types.ObjectId(OTHER_CLAIM_ID), claimant: new mongoose.Types.ObjectId(OTHER_ID) })];
  let approveCount = 0;
  t.mock.method(Claim, 'findById', (id) => ({ lean: async () => claims.find((entry) => entry._id.toString() === id.toString()) }));
  t.mock.method(Item, 'findOneAndUpdate', () => ({ lean: async () => {
    if (!active) return null;
    active = false;
    return { status: 'resolved' };
  } }));
  t.mock.method(Claim, 'findOneAndUpdate', (filter, update) => ({ lean: async () => { approveCount += 1; return { _id: filter._id, status: update.$set.status }; } }));
  t.mock.method(Claim, 'updateMany', async () => ({ modifiedCount: 1 }));
  t.mock.method(Claim, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const results = await Promise.allSettled(claims.map((entry) => approveClaim(entry._id.toString(), user(OWNER_ID))));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'ITEM_ALREADY_RESOLVED').length, 1);
  assert.equal(approveCount, 1);
});

test('claim detail access is scoped and contact data is withheld until approval', async (t) => {
  let current = claim();
  t.mock.method(Claim, 'findById', () => ({ populate: () => query, lean: async () => current }));
  const query = { populate: () => query, lean: async () => ({ ...current, claimant: { _id: current.claimant, name: 'Claimant' }, itemOwner: { _id: current.itemOwner, name: 'Finder' }, item: { _id: current.item, title: 'Blue bag', type: 'found', status: 'active' } }) };
  await assert.rejects(() => getClaimDetails(CLAIM_ID, user(OTHER_ID)), { code: 'FORBIDDEN', statusCode: 403 });
  assert.equal((await getClaimDetails(CLAIM_ID, user(CLAIMANT_ID))).data.claimant.name, 'Claimant');
  let userLookups = 0;
  t.mock.method(User, 'findById', () => { userLookups += 1; return { select: () => ({ lean: async () => ({ name: 'Finder', email: 'finder@example.edu', password: 'secret' }) }) }; });
  await assert.rejects(() => getClaimContact(CLAIM_ID, user(CLAIMANT_ID)), { code: 'CONTACT_NOT_AVAILABLE', statusCode: 409 });
  await assert.rejects(() => getClaimContact(CLAIM_ID, user(OTHER_ID)), { code: 'FORBIDDEN', statusCode: 403 });
  assert.equal(userLookups, 0);
  current = claim({ status: 'approved' });
  const contact = await getClaimContact(CLAIM_ID, user(CLAIMANT_ID));
  assert.deepEqual(contact.data, { name: 'Finder', email: 'finder@example.edu' });
  assert.equal(userLookups, 1);
});
