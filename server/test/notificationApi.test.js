import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Notification from '../src/models/Notification.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'notifications-test-secret';
const RECIPIENT = '64b0000000000000000000a1';
const NOTIFICATION = '64b0000000000000000000a3';

function token(t, id = RECIPIENT) {
  const user = { _id: new mongoose.Types.ObjectId(id), id, name: 'Student', role: 'student', isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return `Bearer ${jwt.sign({ userId: id }, process.env.JWT_SECRET)}`;
}

test('notification APIs authenticate, paginate own notifications, filter unread, and scope updates/deletes', async (t) => {
  const app = createApp();
  const unauthorized = await request(app).get('/api/notifications');
  assert.equal(unauthorized.status, 401);
  const auth = token(t);
  let listFilter;
  const listQuery = { sort: () => listQuery, skip: () => listQuery, limit: () => listQuery, lean: async () => [{ _id: new mongoose.Types.ObjectId(NOTIFICATION), recipient: new mongoose.Types.ObjectId(RECIPIENT), type: 'CLAIM_RECEIVED', title: 'Claim', message: 'Review this claim.', relatedItem: null, relatedClaim: null, relatedMatch: null, isRead: false, createdAt: new Date(), updatedAt: new Date(), privateEmail: 'never-return@example.edu' }] };
  t.mock.method(Notification, 'find', (filter) => { listFilter = filter; return listQuery; });
  t.mock.method(Notification, 'countDocuments', async (filter) => filter.isRead === false || filter.isRead === true ? 3 : 6);
  const unread = await request(app).get('/api/notifications?page=2&limit=2&unread=true').set('Authorization', auth);
  assert.equal(unread.status, 200);
  assert.equal(listFilter.recipient.toString(), RECIPIENT);
  assert.equal(listFilter.isRead, false);
  assert.equal(unread.body.pagination.totalPages, 2);
  assert.equal(JSON.stringify(unread.body).includes('never-return@example.edu'), false);
  const badPage = await request(app).get('/api/notifications?page=0').set('Authorization', auth);
  assert.equal(badPage.status, 400);

  const count = await request(app).get('/api/notifications/unread-count').set('Authorization', auth);
  assert.deepEqual(count.body, { count: 3 });
  let readFilter;
  t.mock.method(Notification, 'findOneAndUpdate', (filter) => { readFilter = filter; return { lean: async () => ({ _id: new mongoose.Types.ObjectId(NOTIFICATION), recipient: new mongoose.Types.ObjectId(RECIPIENT), type: 'CLAIM_RECEIVED', title: 'Claim', message: 'Review this claim.', isRead: true, createdAt: new Date(), updatedAt: new Date() }) }; });
  assert.equal((await request(app).patch(`/api/notifications/${NOTIFICATION}/read`).set('Authorization', auth)).body.data.isRead, true);
  assert.equal(readFilter.recipient.toString(), RECIPIENT);
  let allFilter;
  t.mock.method(Notification, 'updateMany', async (filter) => { allFilter = filter; return { modifiedCount: 2 }; });
  assert.equal((await request(app).patch('/api/notifications/read-all').set('Authorization', auth)).body.data.modifiedCount, 2);
  assert.equal(allFilter.recipient.toString(), RECIPIENT);
  let deleteFilter;
  t.mock.method(Notification, 'findOneAndDelete', async (filter) => { deleteFilter = filter; return { _id: new mongoose.Types.ObjectId(NOTIFICATION) }; });
  const removed = await request(app).delete(`/api/notifications/${NOTIFICATION}`).set('Authorization', auth);
  assert.equal(removed.status, 200);
  assert.equal(deleteFilter.recipient.toString(), RECIPIENT);
});
