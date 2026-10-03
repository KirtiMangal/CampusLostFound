import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import { ITEM_CATEGORIES } from '../../../shared/itemConstants.js';

const roundedPercent = (numerator, denominator) => denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
function mondayUtc(value) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date;
}
function isoDay(value) { return value.toISOString().slice(0, 10); }
function changePercent(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getAnalyticsOverview() {
  const [itemGroups, claimGroups] = await Promise.all([
    Item.aggregate([{ $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } }]),
    Claim.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const counts = { totalItems: 0, activeItems: 0, resolvedItems: 0, lostItems: 0, foundItems: 0, resolvedLostItems: 0 };
  for (const group of itemGroups) {
    const count = group.count || 0;
    counts.totalItems += count;
    if (group._id.status === 'active') counts.activeItems += count;
    if (group._id.status === 'resolved') counts.resolvedItems += count;
    if (group._id.type === 'lost') {
      counts.lostItems += count;
      if (group._id.status === 'resolved') counts.resolvedLostItems += count;
    }
    if (group._id.type === 'found') counts.foundItems += count;
  }
  const claims = { totalClaims: 0, approvedClaims: 0, pendingClaims: 0 };
  for (const group of claimGroups) {
    claims.totalClaims += group.count || 0;
    if (group._id === 'approved') claims.approvedClaims = group.count || 0;
    if (group._id === 'pending') claims.pendingClaims = group.count || 0;
  }
  return { ...counts, ...claims, recoveryRate: roundedPercent(counts.resolvedLostItems, counts.lostItems) };
}

export async function getAnalyticsTrends(now = new Date()) {
  const currentWeek = mondayUtc(now);
  const start = new Date(currentWeek);
  start.setUTCDate(start.getUTCDate() - 7 * 7);
  const end = new Date(currentWeek);
  end.setUTCDate(end.getUTCDate() + 7);
  const weekExpression = (field) => ({ $dateTrunc: { date: `$${field}`, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } });
  const [reportGroups, resolvedGroups] = await Promise.all([
    Item.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { week: weekExpression('createdAt'), type: '$type' }, count: { $sum: 1 } } },
    ]),
    Item.aggregate([
      { $match: { status: 'resolved', $or: [{ resolvedAt: { $gte: start, $lt: end } }, { resolvedAt: null, updatedAt: { $gte: start, $lt: end } }] } },
      { $group: { _id: { $dateTrunc: { date: { $ifNull: ['$resolvedAt', '$updatedAt'] }, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } }, count: { $sum: 1 } } },
    ]),
  ]);
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const week = new Date(start);
    week.setUTCDate(week.getUTCDate() + 7 * index);
    return { week: isoDay(week), lost: 0, found: 0, resolved: 0 };
  });
  const byWeek = new Map(weeks.map((entry) => [entry.week, entry]));
  for (const group of reportGroups) {
    const week = byWeek.get(isoDay(new Date(group._id.week)));
    if (week && ['lost', 'found'].includes(group._id.type)) week[group._id.type] = group.count || 0;
  }
  for (const group of resolvedGroups) {
    const week = byWeek.get(isoDay(new Date(group._id)));
    if (week) week.resolved = group.count || 0;
  }
  const currentFour = weeks.slice(4);
  const previousFour = weeks.slice(0, 4);
  const sum = (entries, key) => entries.reduce((total, entry) => total + entry[key], 0);
  const currentReports = sum(currentFour, 'lost') + sum(currentFour, 'found');
  const previousReports = sum(previousFour, 'lost') + sum(previousFour, 'found');
  const currentResolved = sum(currentFour, 'resolved');
  const previousResolved = sum(previousFour, 'resolved');
  return {
    weeks,
    comparison: {
      current4WeekTotal: currentReports,
      previous4WeekTotal: previousReports,
      percentageChange: changePercent(currentReports, previousReports),
      current4WeekResolved: currentResolved,
      previous4WeekResolved: previousResolved,
      resolvedPercentageChange: changePercent(currentResolved, previousResolved),
    },
    timezone: 'UTC',
  };
}

export async function getCategoryDistribution() {
  const groups = await Item.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const counts = new Map(groups.map((group) => [group._id, group.count || 0]));
  return ITEM_CATEGORIES.map((category) => ({ category, count: counts.get(category) || 0 }));
}

export function getTopLostLocations(limit = 10) {
  return Item.aggregate([
    { $match: { type: 'lost', location: { $type: 'string', $ne: '' } } },
    { $group: { _id: { $toLower: { $trim: { input: '$location' } } }, location: { $first: { $trim: { input: '$location' } } }, count: { $sum: 1 } } },
    { $sort: { count: -1, location: 1 } },
    { $limit: limit },
    { $project: { _id: 0, location: 1, count: 1 } },
  ]);
}

export const analyticsInternals = { mondayUtc, changePercent };
