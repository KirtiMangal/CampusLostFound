import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Claim from '../src/models/Claim.js';
import Item from '../src/models/Item.js';
import Match from '../src/models/Match.js';
import Notification from '../src/models/Notification.js';
import { approveClaim, cancelClaim, createClaim, rejectClaim } from '../src/services/claimService.js';
import { generateMatchesForItem } from '../src/services/matchingService.js';
import { setGeminiClientFactoryForTests } from '../src/services/geminiService.js';

const OWNER = '64b0000000000000000000b1';
const CLAIMANT = '64b0000000000000000000b2';
const OTHER = '64b0000000000000000000b3';
const ITEM_ID = '64b0000000000000000000b4';
const CLAIM_ID = '64b0000000000000000000b5';

function connectedForTest(t) {
  const previous = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = previous; });
}
function notificationStore(t) {
  const created = [];
  t.mock.method(Notification, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  t.mock.method(Notification, 'create', async (input) => {
    const notification = { _id: new mongoose.Types.ObjectId(), ...input, isRead: false, createdAt: new Date(), updatedAt: new Date() };
    created.push(notification);
    return notification;
  });
  return created;
}
const asUser = (value, role = 'student') => ({ _id: new mongoose.Types.ObjectId(value), id: value, role });
const pendingClaim = () => ({ _id: new mongoose.Types.ObjectId(CLAIM_ID), item: new mongoose.Types.ObjectId(ITEM_ID), claimant: new mongoose.Types.ObjectId(CLAIMANT), itemOwner: new mongoose.Types.ObjectId(OWNER), status: 'pending', claimMessage: 'Unique stripe.' });

test('new potential matches notify both item owners without stating ownership is confirmed', async (t) => {
  connectedForTest(t);
  const created = notificationStore(t);
  process.env.GEMINI_API_KEY = 'test-notification-key';
  const source = { _id: new mongoose.Types.ObjectId(ITEM_ID), owner: new mongoose.Types.ObjectId(OWNER), type: 'lost', title: 'Blue water bottle', description: 'steel bottle with sticker', category: 'Accessories', location: 'Library', date: '2026-10-01', status: 'active' };
  const candidate = { _id: new mongoose.Types.ObjectId('64b0000000000000000000b6'), owner: new mongoose.Types.ObjectId(CLAIMANT), type: 'found', title: 'Blue water bottle', description: 'steel bottle with sticker', category: 'Accessories', location: 'Library', date: '2026-10-01', status: 'active' };
  t.mock.method(Item, 'findById', () => ({ lean: async () => source }));
  t.mock.method(Item, 'find', () => { const query = { select: () => query, sort: () => query, limit: () => query, lean: async () => [candidate] }; return query; });
  t.mock.method(Match, 'find', () => ({ lean: async () => [] }));
  t.mock.method(Match, 'findOneAndUpdate', () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId('64b0000000000000000000b7'), finalScore: 94 }) }));
  t.mock.method(Match, 'deleteMany', async () => ({ deletedCount: 0 }));
  const restoreGemini = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => ({ text: JSON.stringify({ confidence: 90, decision: 'possible_match', reasoning: ['Similar details.'], matchingSignals: ['Blue bottle'], contradictingSignals: [], missingInformation: [] }) }) } }));
  t.after(restoreGemini);
  await generateMatchesForItem(ITEM_ID);
  assert.deepEqual(created.map((entry) => entry.type), ['MATCH_FOUND', 'MATCH_FOUND']);
  assert.deepEqual(created.map((entry) => entry.recipient.toString()).sort(), [OWNER, CLAIMANT].sort());
  assert.ok(created.every((entry) => entry.relatedMatch && entry.relatedItem && /possible match/i.test(entry.message)));
  assert.ok(created.every((entry) => !/confirmed|definitely/i.test(entry.message)));
});

test('claim receipt, rejection, and cancellation notify the other participant', async (t) => {
  connectedForTest(t);
  const created = notificationStore(t);
  const item = { _id: new mongoose.Types.ObjectId(ITEM_ID), owner: new mongoose.Types.ObjectId(OWNER), type: 'found', status: 'active' };
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => item }) }));
  t.mock.method(Claim, 'findOne', () => ({ lean: async () => null }));
  const claim = pendingClaim();
  t.mock.method(Claim, 'create', async (input) => ({ ...claim, ...input }));
  await createClaim(ITEM_ID, asUser(CLAIMANT), { claimMessage: 'A distinct sewn label.' });
  assert.equal(created[0].type, 'CLAIM_RECEIVED');
  assert.equal(created[0].recipient.toString(), OWNER);

  t.mock.method(Claim, 'findById', () => ({ lean: async () => claim }));
  t.mock.method(Claim, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => ({ ...claim, status: update.$set.status }) }));
  await rejectClaim(CLAIM_ID, asUser(OWNER), 'Marking differs.');
  await cancelClaim(CLAIM_ID, asUser(CLAIMANT));
  assert.deepEqual(created.slice(1).map((entry) => entry.type), ['CLAIM_REJECTED', 'CLAIM_CANCELLED']);
  assert.equal(created[1].recipient.toString(), CLAIMANT);
  assert.equal(created[2].recipient.toString(), OWNER);
});

test('approved claims notify the claimant and auto-rejected claimants without leaking contacts', async (t) => {
  connectedForTest(t);
  const created = notificationStore(t);
  const claim = pendingClaim();
  const rejectedClaimant = new mongoose.Types.ObjectId(OTHER);
  t.mock.method(Claim, 'findById', () => ({ lean: async () => claim }));
  t.mock.method(Item, 'findOneAndUpdate', () => ({ lean: async () => ({ status: 'resolved' }) }));
  t.mock.method(Claim, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => ({ ...claim, status: update.$set.status }) }));
  t.mock.method(Claim, 'updateMany', async () => ({ modifiedCount: 1 }));
  t.mock.method(Claim, 'find', () => ({ select: () => ({ lean: async () => [{ _id: new mongoose.Types.ObjectId(), claimant: rejectedClaimant }] }) }));
  t.mock.method(Match, 'deleteMany', async () => ({ deletedCount: 0 }));
  await approveClaim(CLAIM_ID, asUser(OWNER));
  assert.deepEqual(created.map((entry) => entry.type).sort(), ['CLAIM_APPROVED', 'CLAIM_REJECTED']);
  assert.ok(created.every((entry) => !JSON.stringify(entry).includes('@')));
});

test('an auto-rejected claim lookup failure does not undo a successful approval', async (t) => {
  connectedForTest(t);
  const created = notificationStore(t);
  const claim = pendingClaim();
  t.mock.method(Claim, 'findById', () => ({ lean: async () => claim }));
  t.mock.method(Item, 'findOneAndUpdate', () => ({ lean: async () => ({ status: 'resolved' }) }));
  t.mock.method(Claim, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => ({ ...claim, status: update.$set.status }) }));
  t.mock.method(Claim, 'updateMany', async () => ({ modifiedCount: 1 }));
  t.mock.method(Claim, 'find', () => ({ select: () => ({ lean: async () => { throw new Error('temporary read failure'); } }) }));
  t.mock.method(Match, 'deleteMany', async () => ({ deletedCount: 0 }));
  const result = await approveClaim(CLAIM_ID, asUser(OWNER));
  assert.equal(result.data.status, 'approved');
  assert.deepEqual(created.map((entry) => entry.type), ['CLAIM_APPROVED']);
});
