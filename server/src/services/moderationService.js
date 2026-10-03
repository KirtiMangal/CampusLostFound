import { randomUUID } from 'node:crypto';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import AdminMutationLock from '../models/AdminMutationLock.js';
import AppError from '../utils/AppError.js';
import { createNotifications } from './notificationService.js';

const ACTIVE_REPORT_STATUSES = ['pending', 'under_review'];
const TARGET_FIELD = { item: 'targetItem', user: 'targetUser', claim: 'targetClaim' };
const REPORTABLE_REASONS = new Set(['harassment', 'fraudulent_claim']);
const LOCK_ID = 'active-admin-account-mutation';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const id = (value) => value?._id?.toString?.() || value?.toString?.() || '';

export function flagReport({ activeTargetReports, recentReporterReports, reason }) {
  let score = 0;
  const signals = [];
  if (activeTargetReports >= 2) { score += 70; signals.push('Multiple active reports target this content.'); }
  if (recentReporterReports >= 8) { score += 75; signals.push('Reporter has submitted many reports in the last hour.'); }
  else if (recentReporterReports >= 5) { score += 30; signals.push('Reporter has submitted several reports in the last hour.'); }
  if (REPORTABLE_REASONS.has(reason)) { score += 20; signals.push('Report reason indicates a higher-impact concern.'); }
  const configuredThreshold = Number(process.env.MODERATION_AUTO_FLAG_THRESHOLD) || 70;
  const threshold = Math.max(0, Math.min(100, configuredThreshold));
  const moderationScore = Math.min(100, score);
  return { moderationScore, autoFlagged: moderationScore >= threshold, priority: moderationScore >= threshold ? 'high' : 'medium', flagSignals: signals };
}

async function notifyModerators(report, actorId) {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    await createNotifications(admins.map((admin) => ({
      recipient: id(admin._id), actorId: id(actorId), type: 'MODERATION_REPORT',
      title: report.autoFlagged ? 'A report was prioritized for review' : 'A high-priority report needs review',
      message: 'A new content report is ready for review in the admin dashboard.', relatedItem: id(report.targetItem) || null, relatedReport: id(report._id),
      dedupeKey: `moderation-report:${id(report._id)}:${id(admin._id)}`,
    })));
  } catch (error) { console.warn('Could not notify admins about a moderation report:', { name: error?.name || 'Error' }); }
}

async function ensureReportTarget(targetType, targetId, reporterId) {
  if (targetType === 'item') {
    const target = await Item.findById(targetId).select('_id owner').lean();
    if (!target) throw new AppError('The reported item was not found.', 404, 'REPORT_TARGET_NOT_FOUND');
    return { targetItem: target._id };
  }
  if (targetType === 'user') {
    if (targetId === id(reporterId)) throw new AppError('You cannot report your own account.', 400, 'CANNOT_REPORT_SELF');
    const target = await User.findById(targetId).select('_id').lean();
    if (!target) throw new AppError('The reported account was not found.', 404, 'REPORT_TARGET_NOT_FOUND');
    return { targetUser: target._id };
  }
  const target = await Claim.findById(targetId).select('_id claimant itemOwner').lean();
  if (!target) throw new AppError('The reported claim was not found.', 404, 'REPORT_TARGET_NOT_FOUND');
  if (id(target.claimant) !== id(reporterId) && id(target.itemOwner) !== id(reporterId)) {
    throw new AppError('Only a participant can report this claim.', 403, 'REPORT_TARGET_FORBIDDEN');
  }
  return { targetClaim: target._id };
}

export async function createReport(reporterId, input) {
  const targetFields = await ensureReportTarget(input.targetType, input.targetId, reporterId);
  const field = TARGET_FIELD[input.targetType];
  const targetId = targetFields[field];
  const identity = { reporter: reporterId, targetType: input.targetType, [field]: targetId };
  const duplicate = await Report.findOne({ ...identity, status: { $in: ACTIVE_REPORT_STATUSES } }).select('_id').lean();
  if (duplicate) throw new AppError('You already have an active report for this content.', 409, 'DUPLICATE_ACTIVE_REPORT');

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [activeTargetReports, recentReporterReports] = await Promise.all([
    Report.countDocuments({ targetType: input.targetType, [field]: targetId, status: { $in: ACTIVE_REPORT_STATUSES } }),
    Report.countDocuments({ reporter: reporterId, createdAt: { $gte: hourAgo } }),
  ]);
  const flags = flagReport({ activeTargetReports, recentReporterReports, reason: input.reason });
  let report;
  try {
    report = await Report.create({ reporter: reporterId, targetType: input.targetType, ...targetFields, activeDuplicateKey: `${id(reporterId)}:${input.targetType}:${id(targetId)}`, reason: input.reason, description: input.description, ...flags });
  } catch (error) {
    if (error?.code === 11000) throw new AppError('You already have an active report for this content.', 409, 'DUPLICATE_ACTIVE_REPORT');
    throw error;
  }
  if (report.priority === 'high') await notifyModerators(report, reporterId);
  return { success: true, data: { id: id(report), status: report.status } };
}

function makeReportFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.autoFlagged !== undefined) filter.autoFlagged = query.autoFlagged;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ description: pattern }, { reason: pattern }];
  }
  return filter;
}

export async function listReports(query) {
  const filter = makeReportFilter(query);
  const sort = query.sort === 'priority' ? { priorityRank: -1, createdAt: -1 } : { createdAt: -1 };
  const [reports, total] = await Promise.all([
    Report.find(filter).select('-flagSignals').populate('reporter', 'name role').sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Report.countDocuments(filter),
  ]);
  const data = reports.map((report) => ({
    id: id(report._id), targetType: report.targetType, targetId: id(report[TARGET_FIELD[report.targetType]]),
    reason: report.reason, description: report.description, status: report.status, priority: report.priority,
    autoFlagged: report.autoFlagged, moderationScore: report.moderationScore,
    reporter: report.reporter ? { id: id(report.reporter._id), name: report.reporter.name, role: report.reporter.role } : null,
    createdAt: report.createdAt, reviewedAt: report.reviewedAt,
  }));
  return { success: true, data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getReportDetails(reportId) {
  const report = await Report.findById(reportId).populate('reporter', 'name role').populate('reviewedBy', 'name role').populate('reviewHistory.actor', 'name role').lean();
  if (!report) throw new AppError('Report not found.', 404, 'REPORT_NOT_FOUND');
  let target = null;
  if (report.targetType === 'item') {
    const item = await Item.findById(report.targetItem).select('title description category type location date status owner isHidden hiddenAt hiddenBy hiddenReason moderationHistory createdAt updatedAt').populate('owner', 'name role isActive').populate('hiddenBy', 'name').populate('moderationHistory.actor', 'name').lean();
    if (item) target = { id: id(item._id), title: item.title, description: item.description, category: item.category, type: item.type, location: item.location, date: item.date, status: item.status, isHidden: item.isHidden, hiddenAt: item.hiddenAt, hiddenReason: item.hiddenReason, moderationHistory: item.moderationHistory || [], owner: item.owner ? { id: id(item.owner._id), name: item.owner.name, role: item.owner.role, isActive: item.owner.isActive } : null, hiddenBy: item.hiddenBy ? { id: id(item.hiddenBy._id), name: item.hiddenBy.name } : null, createdAt: item.createdAt };
  } else if (report.targetType === 'user') {
    const user = await User.findById(report.targetUser).select('name role isActive createdAt suspendedAt suspensionReason').lean();
    if (user) target = { id: id(user._id), name: user.name, role: user.role, isActive: user.isActive, createdAt: user.createdAt, suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason };
  } else {
    const claim = await Claim.findById(report.targetClaim).select('item claimant itemOwner status createdAt reviewedAt').populate('item', 'title type status').populate('claimant', 'name').populate('itemOwner', 'name').lean();
    if (claim) target = { id: id(claim._id), status: claim.status, createdAt: claim.createdAt, reviewedAt: claim.reviewedAt, item: claim.item ? { id: id(claim.item._id), title: claim.item.title, type: claim.item.type, status: claim.item.status } : null, claimant: claim.claimant ? { id: id(claim.claimant._id), name: claim.claimant.name } : null, itemOwner: claim.itemOwner ? { id: id(claim.itemOwner._id), name: claim.itemOwner.name } : null };
  }
  return { success: true, data: {
    id: id(report._id), targetType: report.targetType, targetId: id(report[TARGET_FIELD[report.targetType]]),
    reason: report.reason, description: report.description, status: report.status, priority: report.priority,
    autoFlagged: report.autoFlagged, moderationScore: report.moderationScore, flagSignals: report.flagSignals,
    resolutionNote: report.resolutionNote, reporter: report.reporter ? { id: id(report.reporter._id), name: report.reporter.name, role: report.reporter.role } : null,
    reviewedBy: report.reviewedBy ? { id: id(report.reviewedBy._id), name: report.reviewedBy.name, role: report.reviewedBy.role } : null,
    createdAt: report.createdAt, updatedAt: report.updatedAt, reviewedAt: report.reviewedAt,
    reviewHistory: (report.reviewHistory || []).map((entry) => ({ status: entry.status, priority: entry.priority, note: entry.note, itemAction: entry.itemAction, actor: entry.actor ? { id: id(entry.actor._id), name: entry.actor.name, role: entry.actor.role } : null, at: entry.at })), target,
  } };
}

export async function moderateItem(itemId, action, adminId) {
  const item = await Item.findById(itemId).select('_id isHidden hiddenBySuspension').lean();
  if (!item) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  const now = new Date();
  const update = action === 'hide'
    ? { $set: { isHidden: true, hiddenAt: now, hiddenBy: adminId, hiddenReason: 'ADMIN_MODERATION', hiddenBySuspension: false }, $push: { moderationHistory: { $each: [{ action: 'hidden', reason: 'ADMIN_MODERATION', actor: adminId, at: now }], $slice: -20 } } }
    : { $set: { isHidden: false, hiddenBySuspension: false }, $push: { moderationHistory: { $each: [{ action: 'restored', reason: 'ADMIN_RESTORED', actor: adminId, at: now }], $slice: -20 } } };
  await Item.updateOne({ _id: itemId }, update);
}

const ALLOWED_TRANSITIONS = { pending: new Set(['pending', 'under_review', 'resolved', 'dismissed']), under_review: new Set(['under_review', 'resolved', 'dismissed']), resolved: new Set(['resolved']), dismissed: new Set(['dismissed']) };

export async function reviewReport(reportId, adminId, input) {
  const report = await Report.findById(reportId);
  if (!report) throw new AppError('Report not found.', 404, 'REPORT_NOT_FOUND');
  const nextStatus = input.status || report.status;
  if (!ALLOWED_TRANSITIONS[report.status]?.has(nextStatus)) throw new AppError('This report has already reached a final status.', 409, 'REPORT_STATUS_FINAL');
  if (input.itemAction && report.targetType !== 'item') throw new AppError('Item moderation actions require an item report.', 400, 'ITEM_ACTION_REQUIRES_ITEM_REPORT');
  if (input.itemAction) await moderateItem(report.targetItem, input.itemAction, adminId);
  report.status = nextStatus;
  if (input.priority) report.priority = input.priority;
  if (input.resolutionNote !== undefined) report.resolutionNote = input.resolutionNote;
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  if (['resolved', 'dismissed'].includes(nextStatus)) report.activeDuplicateKey = undefined;
  report.reviewHistory.push({ status: nextStatus, priority: report.priority, note: input.resolutionNote ?? report.resolutionNote, itemAction: input.itemAction || null, actor: adminId, at: report.reviewedAt });
  if (report.reviewHistory.length > 20) report.reviewHistory.splice(0, report.reviewHistory.length - 20);
  await report.save();
  return { success: true, data: { id: id(report), status: report.status, priority: report.priority, resolutionNote: report.resolutionNote, reviewedAt: report.reviewedAt, reviewedBy: id(report.reviewedBy) } };
}

export async function listAdminUsers(query) {
  const filter = {};
  if (query.active !== undefined) filter.isActive = query.active;
  if (query.role) filter.role = query.role;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const sort = query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
  const [users, total, activeAdminCount] = await Promise.all([
    User.find(filter).select('name email role isActive createdAt suspendedAt suspensionReason').sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    User.countDocuments(filter),
    User.countDocuments({ role: 'admin', isActive: true }),
  ]);
  return { success: true, data: users.map((user) => ({ id: id(user._id), name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt, suspendedAt: user.suspendedAt, suspensionReason: user.suspensionReason })), activeAdminCount, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

async function withAdminMutationLock(work) {
  try { await AdminMutationLock.updateOne({ _id: LOCK_ID }, { $setOnInsert: { leaseUntil: new Date(0), token: null } }, { upsert: true }); }
  catch (error) { if (error?.code !== 11000) throw error; }
  const token = randomUUID();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const now = new Date();
    const acquired = await AdminMutationLock.findOneAndUpdate({ _id: LOCK_ID, leaseUntil: { $lte: now } }, { $set: { token, leaseUntil: new Date(now.getTime() + 120_000) } }, { new: true }).lean();
    if (acquired?.token === token) {
      try { return await work(); }
      finally { await AdminMutationLock.updateOne({ _id: LOCK_ID, token }, { $set: { leaseUntil: new Date(0) }, $unset: { token: 1 } }); }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new AppError('Another admin account change is in progress. Please try again.', 503, 'ADMIN_MUTATION_BUSY');
}

async function cascadeSuspension(userId, adminId) {
  const now = new Date();
  const outcomes = await Promise.allSettled([
    Item.updateMany({ owner: userId, status: 'active', isHidden: { $ne: true } }, { $set: { isHidden: true, hiddenAt: now, hiddenBy: adminId, hiddenReason: 'ACCOUNT_SUSPENDED', hiddenBySuspension: true }, $push: { moderationHistory: { $each: [{ action: 'hidden', reason: 'ACCOUNT_SUSPENDED', actor: adminId, at: now }], $slice: -20 } } }),
    Claim.updateMany({ claimant: userId, status: 'pending' }, { $set: { status: 'cancelled', rejectionReason: 'Claimant account was suspended during review.', reviewedAt: now, reviewedBy: adminId } }),
    Claim.updateMany({ itemOwner: userId, status: 'pending' }, { $set: { status: 'rejected', rejectionReason: 'Item owner account was suspended during review.', reviewedAt: now, reviewedBy: adminId } }),
  ]);
  const failed = outcomes.filter((entry) => entry.status === 'rejected');
  if (failed.length) console.warn('Some suspension cleanup operations failed:', { count: failed.length });
  return failed.length === 0;
}

export async function suspendUser(userId, adminId, reason) {
  if (id(userId) === id(adminId)) throw new AppError('You cannot suspend your own admin account.', 400, 'CANNOT_SUSPEND_SELF');
  return withAdminMutationLock(async () => {
    const target = await User.findById(userId).select('_id role isActive').lean();
    if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    if (!target.isActive) throw new AppError('This account is already suspended.', 409, 'ACCOUNT_ALREADY_SUSPENDED');
    if (target.role === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) throw new AppError('The last active administrator cannot be suspended.', 409, 'LAST_ACTIVE_ADMIN');
    }
    const now = new Date();
    const updated = await User.findOneAndUpdate({ _id: userId, isActive: true }, { $set: { isActive: false, suspendedAt: now, suspendedBy: adminId, suspensionReason: reason }, $push: { suspensionHistory: { $each: [{ action: 'suspended', reason, actor: adminId, at: now }], $slice: -20 } } }, { new: true }).select('_id isActive suspendedAt suspensionReason').lean();
    if (!updated) throw new AppError('This account changed while it was being suspended. Reload and try again.', 409, 'USER_STATE_CONFLICT');
    const cleanupComplete = await cascadeSuspension(userId, adminId);
    return { success: true, data: { id: id(updated._id), isActive: updated.isActive, suspendedAt: updated.suspendedAt, suspensionReason: updated.suspensionReason, cleanupComplete } };
  });
}

export async function unsuspendUser(userId, adminId) {
  return withAdminMutationLock(async () => {
    const target = await User.findById(userId).select('_id isActive suspensionReason').lean();
    if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    if (target.isActive) throw new AppError('This account is already active.', 409, 'ACCOUNT_ALREADY_ACTIVE');
    const now = new Date();
    const updated = await User.findOneAndUpdate({ _id: userId, isActive: false }, { $set: { isActive: true, suspendedAt: null, suspendedBy: null, suspensionReason: '' }, $push: { suspensionHistory: { $each: [{ action: 'unsuspended', reason: target.suspensionReason || 'Account restored by an administrator.', actor: adminId, at: now }], $slice: -20 } } }, { new: true }).select('_id isActive').lean();
    if (!updated) throw new AppError('This account changed while it was being restored. Reload and try again.', 409, 'USER_STATE_CONFLICT');
    const outcomes = await Promise.allSettled([
      Item.updateMany({ owner: userId, hiddenBySuspension: true }, { $set: { isHidden: false, hiddenBySuspension: false }, $push: { moderationHistory: { $each: [{ action: 'restored', reason: 'ACCOUNT_RESTORED', actor: adminId, at: now }], $slice: -20 } } }),
    ]);
    const cleanupComplete = outcomes.every((entry) => entry.status === 'fulfilled');
    if (!cleanupComplete) console.warn('Could not restore all account-suspended items:', { count: outcomes.filter((entry) => entry.status === 'rejected').length });
    await createNotifications([{ recipient: id(userId), actorId: id(adminId), type: 'ACCOUNT_REACTIVATED', title: 'Your CampusFind account is active again', message: 'You can sign in and use CampusFind again.', dedupeKey: `account-reactivated:${id(updated._id)}:${now.getTime()}` }]);
    return { success: true, data: { id: id(updated._id), isActive: true, cleanupComplete } };
  });
}

export const moderationInternals = { flagReport, makeReportFilter, withAdminMutationLock };
