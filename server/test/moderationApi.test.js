import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import AdminMutationLock from '../src/models/AdminMutationLock.js';
import Claim from '../src/models/Claim.js';
import Item from '../src/models/Item.js';
import Report from '../src/models/Report.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'moderation-test-secret';
const STUDENT = '64b0000000000000000000d1';
const ADMIN = '64b0000000000000000000d2';
const TARGET = '64b0000000000000000000d3';
const REPORT = '64b0000000000000000000d4';

test('report creation requires auth and validates target IDs and reason before querying', async (t) => {
  let user = { _id: new mongoose.Types.ObjectId(STUDENT), name: 'Student', role: 'student', isActive: true };
  let itemQueries = 0;
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(Item, 'findById', () => { itemQueries += 1; return { select: () => ({ lean: async () => null }) }; });
  const app = createApp();
  assert.equal((await request(app).post('/api/reports').send({})).status, 401);
  const auth = `Bearer ${jwt.sign({ userId: STUDENT }, process.env.JWT_SECRET)}`;
  const badId = await request(app).post('/api/reports').set('Authorization', auth).send({ targetType: 'item', targetId: 'bad', reason: 'other' });
  assert.equal(badId.status, 400);
  const badReason = await request(app).post('/api/reports').set('Authorization', auth).send({ targetType: 'item', targetId: TARGET, reason: 'whatever' });
  assert.equal(badReason.status, 400);
  assert.equal(itemQueries, 0);
  const missing = await request(app).post('/api/reports').set('Authorization', auth).send({ targetType: 'item', targetId: TARGET, reason: 'other' });
  assert.equal(missing.status, 404);
});

test('an authenticated user can submit a report and cannot create a duplicate active report', async (t) => {
  const user = { _id: new mongoose.Types.ObjectId(STUDENT), name: 'Student', role: 'student', isActive: true };
  let duplicate = null;
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(TARGET), owner: new mongoose.Types.ObjectId(ADMIN) }) }) }));
  t.mock.method(Report, 'findOne', () => ({ select: () => ({ lean: async () => duplicate }) }));
  t.mock.method(Report, 'countDocuments', async () => 0);
  t.mock.method(Report, 'create', async (data) => ({ _id: new mongoose.Types.ObjectId(REPORT), status: 'pending', ...data }));
  const token = `Bearer ${jwt.sign({ userId: STUDENT }, process.env.JWT_SECRET)}`;
  const app = createApp();
  const submitted = await request(app).post('/api/reports').set('Authorization', token).send({ targetType: 'item', targetId: TARGET, reason: 'spam' });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.status, 'pending');
  assert.deepEqual(Object.keys(submitted.body.data).sort(), ['id', 'status']);
  duplicate = { _id: new mongoose.Types.ObjectId(REPORT) };
  const repeated = await request(app).post('/api/reports').set('Authorization', token).send({ targetType: 'item', targetId: TARGET, reason: 'spam' });
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.code, 'DUPLICATE_ACTIVE_REPORT');
});

test('only admins can list and inspect reports; details omit target-user contact information', async (t) => {
  let currentRole = 'student';
  let listCalls = 0;
  const authUser = { _id: new mongoose.Types.ObjectId(ADMIN), name: 'Moderator', email: 'moderator@example.edu', role: 'student', isActive: true };
  t.mock.method(User, 'findById', (id) => {
    if (id.toString() === ADMIN) return { select: async () => ({ ...authUser, role: currentRole }) };
    return { select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(TARGET), name: 'Reported account', role: 'student', isActive: true, createdAt: new Date('2026-09-01T00:00:00Z') }) }) };
  });
  const record = { _id: new mongoose.Types.ObjectId(REPORT), reporter: { _id: new mongoose.Types.ObjectId(STUDENT), name: 'Reporter', role: 'student' }, reviewedBy: null, targetType: 'user', targetUser: new mongoose.Types.ObjectId(TARGET), reason: 'harassment', description: 'Review this account.', status: 'pending', priority: 'medium', autoFlagged: false, moderationScore: 20, flagSignals: ['higher-impact concern'], resolutionNote: '', reviewHistory: [], createdAt: new Date(), updatedAt: new Date() };
  t.mock.method(Report, 'find', () => { listCalls += 1; const query = { select: () => query, populate: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => [record] }; return query; });
  t.mock.method(Report, 'countDocuments', async () => 1);
  t.mock.method(Report, 'findById', () => { const query = { populate: () => query, lean: async () => record }; return query; });
  const app = createApp();
  const token = `Bearer ${jwt.sign({ userId: ADMIN }, process.env.JWT_SECRET)}`;
  const denied = await request(app).get('/api/admin/reports').set('Authorization', token);
  assert.equal(denied.status, 403);
  assert.equal(listCalls, 0);
  currentRole = 'admin';
  const listed = await request(app).get('/api/admin/reports?status=pending&page=1&limit=10&sort=priority').set('Authorization', token);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.pagination.total, 1);
  assert.equal(listed.body.data[0].reporter.name, 'Reporter');
  const details = await request(app).get(`/api/admin/reports/${REPORT}`).set('Authorization', token);
  assert.equal(details.status, 200);
  assert.equal(details.body.data.target.name, 'Reported account');
  assert.equal(JSON.stringify(details.body).includes('@'), false);
  currentRole = 'student';
  assert.equal((await request(app).get(`/api/admin/reports/${REPORT}`).set('Authorization', token)).status, 403);
});

test('admins can review and record a report; invalid transitions are rejected', async (t) => {
  const authUser = { _id: new mongoose.Types.ObjectId(ADMIN), name: 'Moderator', role: 'admin', isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => authUser }));
  const report = { _id: new mongoose.Types.ObjectId(REPORT), status: 'pending', priority: 'medium', resolutionNote: '', reviewHistory: [], targetType: 'user', save: async () => {} };
  t.mock.method(Report, 'findById', async () => report);
  const app = createApp();
  const token = `Bearer ${jwt.sign({ userId: ADMIN }, process.env.JWT_SECRET)}`;
  const reviewed = await request(app).patch(`/api/admin/reports/${REPORT}/review`).set('Authorization', token).send({ status: 'under_review', priority: 'high', resolutionNote: 'Checked by the admin team.' });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.status, 'under_review');
  assert.equal(report.reviewHistory.length, 1);
  assert.equal(report.reviewHistory[0].note, 'Checked by the admin team.');
  report.status = 'resolved';
  const reopened = await request(app).patch(`/api/admin/reports/${REPORT}/review`).set('Authorization', token).send({ status: 'pending' });
  assert.equal(reopened.status, 409);
});

test('admin user listing excludes passwords and validates filters', async (t) => {
  const authUser = { _id: new mongoose.Types.ObjectId(ADMIN), name: 'Moderator', role: 'admin', isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => authUser }));
  t.mock.method(User, 'find', () => { const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => [{ _id: new mongoose.Types.ObjectId(TARGET), name: 'Person', email: 'person@example.edu', role: 'student', isActive: true, password: 'must-not-appear', createdAt: new Date() }] }; return query; });
  t.mock.method(User, 'countDocuments', async () => 1);
  const app = createApp();
  const token = `Bearer ${jwt.sign({ userId: ADMIN }, process.env.JWT_SECRET)}`;
  const response = await request(app).get('/api/admin/users?active=true&role=student').set('Authorization', token);
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].email, 'person@example.edu');
  assert.equal(JSON.stringify(response.body).includes('password'), false);
});

test('admin suspend and unsuspend routes persist state and cascade without deleting history', async (t) => {
  let active = true;
  t.mock.method(User, 'findById', (id) => {
    if (id.toString() === ADMIN) return { select: async () => ({ _id: new mongoose.Types.ObjectId(ADMIN), role: 'admin', isActive: true }) };
    return { select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(TARGET), role: 'student', isActive: active, suspensionReason: active ? '' : 'Repeated abuse' }) }) };
  });
  t.mock.method(User, 'countDocuments', async () => 2);
  t.mock.method(User, 'findOneAndUpdate', (_filter, update) => {
    active = update.$set.isActive;
    return { select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(TARGET), isActive: active, suspendedAt: active ? null : new Date(), suspensionReason: active ? '' : 'Repeated abuse' }) }) };
  });
  t.mock.method(AdminMutationLock, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(AdminMutationLock, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => ({ token: update.$set.token }) }));
  t.mock.method(Item, 'updateMany', async () => ({ modifiedCount: 1 }));
  t.mock.method(Claim, 'updateMany', async () => ({ modifiedCount: 0 }));
  const app = createApp();
  const token = `Bearer ${jwt.sign({ userId: ADMIN }, process.env.JWT_SECRET)}`;
  const suspended = await request(app).patch(`/api/admin/users/${TARGET}/suspend`).set('Authorization', token).send({ reason: 'Repeated abuse reports' });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.data.isActive, false);
  const restored = await request(app).patch(`/api/admin/users/${TARGET}/unsuspend`).set('Authorization', token);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.isActive, true);
});

test('an old JWT cannot access items, claims, or report creation after account suspension', async (t) => {
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(STUDENT), name: 'Student', role: 'student', isActive: false }) }));
  const token = `Bearer ${jwt.sign({ userId: STUDENT }, process.env.JWT_SECRET)}`;
  const app = createApp();
  assert.equal((await request(app).get('/api/items').set('Authorization', token)).status, 401);
  assert.equal((await request(app).get('/api/claims/mine').set('Authorization', token)).status, 401);
  assert.equal((await request(app).post('/api/reports').set('Authorization', token).send({ targetType: 'item', targetId: TARGET, reason: 'other' })).status, 401);
});
