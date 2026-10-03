import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import AdminMutationLock from '../src/models/AdminMutationLock.js';
import Claim from '../src/models/Claim.js';
import Item from '../src/models/Item.js';
import Notification from '../src/models/Notification.js';
import Report from '../src/models/Report.js';
import User from '../src/models/User.js';
import { createReport, flagReport, moderateItem } from '../src/services/moderationService.js';
import { suspendUser, unsuspendUser } from '../src/services/moderationService.js';

const ADMIN = '64b0000000000000000000c1';
const STUDENT = '64b0000000000000000000c2';
const ITEM = '64b0000000000000000000c3';
const CLAIM = '64b0000000000000000000c4';
test('automatic moderation scoring is explainable and only prioritizes review', () => {
  assert.deepEqual(flagReport({ activeTargetReports: 0, recentReporterReports: 0, reason: 'other' }), { moderationScore: 0, autoFlagged: false, priority: 'medium', flagSignals: [] });
  const score = flagReport({ activeTargetReports: 2, recentReporterReports: 0, reason: 'other' });
  assert.equal(score.moderationScore, 70);
  assert.equal(score.autoFlagged, true);
  assert.equal(score.priority, 'high');
  assert.match(score.flagSignals.join(' '), /multiple active reports/i);
  assert.equal('isActive' in score, false);
});

test('creates a validated report and rejects a duplicate active report', async (t) => {
  let created;
  let activeCount = 0;
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(STUDENT) }) }) }));
  t.mock.method(Report, 'findOne', () => ({ select: () => ({ lean: async () => activeCount ? { _id: new mongoose.Types.ObjectId() } : null }) }));
  t.mock.method(Report, 'countDocuments', async (filter) => filter.targetType ? 2 : 0);
  t.mock.method(Report, 'create', async (fields) => { created = { _id: new mongoose.Types.ObjectId(), ...fields, status: 'pending' }; return created; });
  t.mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const result = await createReport(STUDENT, { targetType: 'item', targetId: ITEM, reason: 'fake_information', description: 'Details to review.' });
  assert.equal(result.data.status, 'pending');
  assert.equal(created.autoFlagged, true);
  assert.equal(created.priority, 'high');
  assert.equal(created.targetItem.toString(), ITEM);
  assert.equal('email' in result.data, false);
  activeCount = 1;
  await assert.rejects(() => createReport(STUDENT, { targetType: 'item', targetId: ITEM, reason: 'fake_information', description: '' }), { code: 'DUPLICATE_ACTIVE_REPORT', statusCode: 409 });
});

test('high-priority reports notify admins through the existing notification model', async (t) => {
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = originalState; });
  const adminId = new mongoose.Types.ObjectId(ADMIN);
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM) }) }) }));
  t.mock.method(Report, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  t.mock.method(Report, 'countDocuments', async (filter) => filter.targetType ? 2 : 0);
  let report;
  t.mock.method(Report, 'create', async (input) => { report = { _id: new mongoose.Types.ObjectId(), status: 'pending', ...input }; return report; });
  t.mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [{ _id: adminId }] }) }));
  t.mock.method(Notification, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  let notification;
  t.mock.method(Notification, 'create', async (input) => { notification = input; return { _id: new mongoose.Types.ObjectId(), ...input, isRead: false }; });
  await createReport(STUDENT, { targetType: 'item', targetId: ITEM, reason: 'other', description: '' });
  assert.equal(report.autoFlagged, true);
  assert.equal(notification.type, 'MODERATION_REPORT');
  assert.equal(notification.relatedReport, report._id.toString());
  assert.equal(notification.relatedItem.toString(), ITEM);
});

test('rejects missing targets, self-reports, and claims reported by nonparticipants', async (t) => {
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => null }) }));
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => null }) }));
  t.mock.method(Claim, 'findById', () => ({ select: () => ({ lean: async () => ({ claimant: new mongoose.Types.ObjectId(ADMIN), itemOwner: new mongoose.Types.ObjectId(STUDENT) }) }) }));
  await assert.rejects(() => createReport(STUDENT, { targetType: 'item', targetId: ITEM, reason: 'other', description: '' }), { code: 'REPORT_TARGET_NOT_FOUND' });
  await assert.rejects(() => createReport(STUDENT, { targetType: 'user', targetId: STUDENT, reason: 'other', description: '' }), { code: 'CANNOT_REPORT_SELF' });
  await assert.rejects(() => createReport('64b0000000000000000000c9', { targetType: 'claim', targetId: CLAIM, reason: 'other', description: '' }), { code: 'REPORT_TARGET_FORBIDDEN' });
});

function mockLock(t) {
  t.mock.method(AdminMutationLock, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(AdminMutationLock, 'findOneAndUpdate', (_filter, value) => ({ lean: async () => ({ token: value.$set.token }) }));
}

test('suspension protects self and the last admin, then hides listings and handles pending claims', async (t) => {
  mockLock(t);
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(STUDENT), role: 'admin', isActive: true }) }) }));
  let activeAdmins = 1;
  t.mock.method(User, 'countDocuments', async () => activeAdmins);
  let update;
  t.mock.method(User, 'findOneAndUpdate', (_filter, value) => { update = value; return { select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(STUDENT), isActive: false, suspendedAt: new Date(), suspensionReason: 'Repeated abuse' }) }) }; });
  const itemUpdates = [];
  const claimUpdates = [];
  t.mock.method(Item, 'updateMany', async (filter, value) => { itemUpdates.push({ filter, value }); return {}; });
  t.mock.method(Claim, 'updateMany', async (filter, value) => { claimUpdates.push({ filter, value }); return {}; });

  await assert.rejects(() => suspendUser(ADMIN, ADMIN, 'Self'), { code: 'CANNOT_SUSPEND_SELF' });
  await assert.rejects(() => suspendUser(STUDENT, ADMIN, 'Repeated abuse'), { code: 'LAST_ACTIVE_ADMIN' });
  activeAdmins = 2;
  const result = await suspendUser(STUDENT, ADMIN, 'Repeated abuse');
  assert.equal(result.data.isActive, false);
  assert.equal(result.data.cleanupComplete, true);
  assert.equal(update.$set.isActive, false);
  assert.equal(update.$push.suspensionHistory.$each[0].reason, 'Repeated abuse');
  assert.equal(itemUpdates.length, 1);
  assert.equal(itemUpdates[0].value.$set.hiddenReason, 'ACCOUNT_SUSPENDED');
  assert.equal(claimUpdates.length, 2);
  assert.equal(claimUpdates[0].value.$set.status, 'cancelled');
  assert.equal(claimUpdates[1].value.$set.status, 'rejected');
});

test('unsuspension restores only suspension-hidden items and preserves an audit event', async (t) => {
  mockLock(t);
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(STUDENT), isActive: false, suspensionReason: 'Old reason' }) }) }));
  let update;
  t.mock.method(User, 'findOneAndUpdate', (_filter, value) => { update = value; return { select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(STUDENT), isActive: true }) }) }; });
  let itemFilter;
  let itemUpdate;
  t.mock.method(Item, 'updateMany', async (filter, value) => { itemFilter = filter; itemUpdate = value; return {}; });
  const result = await unsuspendUser(STUDENT, ADMIN);
  assert.equal(result.data.isActive, true);
  assert.equal(update.$push.suspensionHistory.$each[0].reason, 'Old reason');
  assert.equal(itemFilter.hiddenBySuspension, true);
  assert.equal(itemUpdate.$set.hiddenBySuspension, false);
  assert.equal(itemUpdate.$push.moderationHistory.$each[0].reason, 'ACCOUNT_RESTORED');
});

test('admin item moderation is reversible and records each visibility action', async (t) => {
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM) }) }) }));
  const updates = [];
  t.mock.method(Item, 'updateOne', async (_filter, update) => { updates.push(update); return { modifiedCount: 1 }; });
  await moderateItem(ITEM, 'hide', ADMIN);
  await moderateItem(ITEM, 'unhide', ADMIN);
  assert.equal(updates[0].$set.isHidden, true);
  assert.equal(updates[0].$push.moderationHistory.$each[0].action, 'hidden');
  assert.equal(updates[1].$set.isHidden, false);
  assert.equal(updates[1].$push.moderationHistory.$each[0].action, 'restored');
});
