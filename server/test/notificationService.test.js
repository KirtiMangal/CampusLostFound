import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Notification from '../src/models/Notification.js';
import { createNotification, createNotifications, deleteNotification, getUnreadNotificationCount, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../src/services/notificationService.js';

const RECIPIENT = '64b000000000000000000081';
const OTHER = '64b000000000000000000082';
const ITEM = '64b000000000000000000083';
const NOTIFICATION = '64b000000000000000000084';
const record = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(NOTIFICATION), recipient: new mongoose.Types.ObjectId(RECIPIENT), type: 'MATCH_FOUND',
  title: 'Possible match', message: 'A possible match was found.', relatedItem: new mongoose.Types.ObjectId(ITEM), relatedMatch: null, relatedClaim: null,
  isRead: false, createdAt: new Date('2026-10-01T10:00:00Z'), updatedAt: new Date('2026-10-01T10:00:00Z'), ...overrides,
});

test('validates notification events, blocks self-events, and de-duplicates retries', async (t) => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = originalState; });
  let createCalls = 0;
  let alreadyExists = false;
  t.mock.method(Notification, 'findOne', () => ({ select: () => ({ lean: async () => alreadyExists ? { _id: NOTIFICATION } : null }) }));
  t.mock.method(Notification, 'create', async (data) => { createCalls += 1; return record({ ...data, _id: new mongoose.Types.ObjectId() }); });
  const event = { recipient: RECIPIENT, type: 'MATCH_FOUND', title: 'Possible match', message: 'Review your report.', relatedItem: ITEM, dedupeKey: 'match:test:recipient' };
  const created = await createNotification(event);
  assert.equal(created.isRead, false);
  assert.equal(created.relatedItem, ITEM);
  assert.equal(Object.hasOwn(created, 'recipient'), false);
  alreadyExists = true;
  assert.equal(await createNotification(event), null);
  assert.equal(await createNotification({ ...event, actorId: RECIPIENT }), null);
  assert.equal(createCalls, 1);
  await assert.rejects(() => createNotification({ ...event, type: 'MODERATION_EVENT' }), { code: 'NOTIFICATION_INVALID', statusCode: 400 });
});

test('lists only the requested recipient with pagination and unread filtering', async (t) => {
  let filter;
  let pagination;
  t.mock.method(Notification, 'find', (value) => {
    filter = value;
    const query = { sort: (sort) => { assert.deepEqual(sort, { createdAt: -1 }); return query; }, skip: (skip) => { pagination = { ...pagination, skip }; return query; }, limit: (limit) => { pagination = { ...pagination, limit }; return query; }, lean: async () => [record({ recipient: { _id: RECIPIENT, email: 'private@example.edu' } })] };
    return query;
  });
  const countFilters = [];
  t.mock.method(Notification, 'countDocuments', async (value) => { countFilters.push(value); return 3; });
  const result = await getUserNotifications(RECIPIENT, { page: 2, limit: 2, unread: true });
  assert.deepEqual(filter, { recipient: RECIPIENT, isRead: false });
  assert.deepEqual(pagination, { skip: 2, limit: 2 });
  assert.equal(result.pagination.totalPages, 2);
  assert.equal(JSON.stringify(result).includes('private@example.edu'), false);
  assert.equal(await getUnreadNotificationCount(RECIPIENT), 3);
  assert.deepEqual(countFilters[1], { recipient: RECIPIENT, isRead: false });
});

test('mark-read, mark-all, and delete operations scope every write to the authenticated recipient', async (t) => {
  let oneFilter;
  let allFilter;
  let deleteFilter;
  t.mock.method(Notification, 'findOneAndUpdate', (filter) => { oneFilter = filter; return { lean: async () => record({ isRead: true }) }; });
  t.mock.method(Notification, 'updateMany', async (filter) => { allFilter = filter; return { modifiedCount: 2 }; });
  t.mock.method(Notification, 'findOneAndDelete', async (filter) => { deleteFilter = filter; return record(); });
  const read = await markNotificationAsRead(NOTIFICATION, RECIPIENT);
  assert.equal(read.data.isRead, true);
  assert.equal(oneFilter.recipient, RECIPIENT);
  assert.equal((await markAllNotificationsAsRead(RECIPIENT)).data.modifiedCount, 2);
  assert.deepEqual(allFilter, { recipient: RECIPIENT, isRead: false });
  assert.equal((await deleteNotification(NOTIFICATION, OTHER)).success, true);
  assert.equal(deleteFilter.recipient, OTHER);
  await assert.rejects(() => markNotificationAsRead('bad-id', RECIPIENT), { code: 'INVALID_NOTIFICATION_ID', statusCode: 400 });
});

test('best-effort event batches are skipped if the database is disconnected', async () => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 0;
  try { assert.equal(await createNotifications([{ recipient: RECIPIENT, type: 'CLAIM_RECEIVED', title: 'Claim', message: 'Review.' }]), 0); }
  finally { mongoose.connection.readyState = originalState; }
});
