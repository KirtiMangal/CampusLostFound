import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { createNotifications } from './notificationService.js';

const id = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const safeClaim = (claim) => ({
  id: id(claim),
  item: claim.item && typeof claim.item === 'object' ? { id: id(claim.item), title: claim.item.title, type: claim.item.type, status: claim.item.status } : id(claim.item),
  claimant: claim.claimant && typeof claim.claimant === 'object' ? { id: id(claim.claimant), name: claim.claimant.name } : id(claim.claimant),
  itemOwner: claim.itemOwner && typeof claim.itemOwner === 'object' ? { id: id(claim.itemOwner), name: claim.itemOwner.name } : undefined,
  status: claim.status, claimMessage: claim.claimMessage, rejectionReason: claim.rejectionReason || '',
  createdAt: claim.createdAt, reviewedAt: claim.reviewedAt,
});

function ensureId(value, kind = 'claim') {
  if (!mongoose.isValidObjectId(value)) throw new AppError(`Invalid ${kind} ID.`, 400, `INVALID_${kind.toUpperCase()}_ID`);
}
function notFound() { throw new AppError('Claim not found.', 404, 'CLAIM_NOT_FOUND'); }
function canReview(claim, user) { return user.role === 'admin' || id(claim.itemOwner) === id(user); }
function ensurePending(claim) {
  if (claim.status !== 'pending') throw new AppError('This claim can no longer be changed.', 409, 'CLAIM_NOT_PENDING');
}
async function findClaim(claimId) {
  ensureId(claimId);
  return Claim.findById(claimId).lean();
}

export async function createClaim(itemId, user, data) {
  ensureId(itemId, 'item');
  const item = await Item.findById(itemId).select('_id type status owner isHidden').lean();
  if (!item) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  if (item.type !== 'found') throw new AppError('Claims can only be submitted for found items.', 400, 'CLAIM_REQUIRES_FOUND_ITEM');
  if (item.status !== 'active') throw new AppError('This item is already resolved and cannot receive claims.', 409, 'ITEM_ALREADY_RESOLVED');
  if (item.isHidden) throw new AppError('This item is not accepting claims.', 409, 'ITEM_HIDDEN');
  if (id(item.owner) === id(user)) throw new AppError('You cannot claim your own item.', 403, 'CANNOT_CLAIM_OWN_ITEM');
  const existing = await Claim.findOne({ item: item._id, claimant: user._id || user.id, status: 'pending' }).lean();
  if (existing) throw new AppError('You already have a pending claim for this item.', 409, 'DUPLICATE_PENDING_CLAIM');
  try {
    const claim = await Claim.create({ item: item._id, claimant: user._id || user.id, itemOwner: item.owner, claimMessage: data.claimMessage, status: 'pending' });
    await createNotifications([{
      recipient: id(item.owner), actorId: id(user), type: 'CLAIM_RECEIVED', title: 'A new ownership claim was submitted',
      message: 'Someone submitted an ownership claim for your found item. Review it in your dashboard.',
      relatedItem: id(item._id), relatedClaim: id(claim), dedupeKey: `claim-received:${id(claim)}`,
    }]);
    return { id: id(claim), status: claim.status };
  } catch (error) {
    if (error?.code === 11000) throw new AppError('You already have a pending claim for this item.', 409, 'DUPLICATE_PENDING_CLAIM');
    throw error;
  }
}

export async function listClaimsForItem(itemId, user) {
  ensureId(itemId, 'item');
  const item = await Item.findById(itemId).select('_id owner').lean();
  if (!item) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  if (user.role !== 'admin' && id(item.owner) !== id(user)) throw new AppError('Only the item owner can review its claims.', 403, 'FORBIDDEN');
  const claims = await Claim.find({ item: item._id }).populate('claimant', 'name').populate('item', 'title type status').sort({ createdAt: -1 }).lean();
  return { success: true, data: claims.map(safeClaim) };
}

export async function listMyClaims(user, received = false) {
  const claims = await Claim.find(received ? { itemOwner: user._id || user.id } : { claimant: user._id || user.id })
    .populate('claimant', 'name').populate('itemOwner', 'name').populate('item', 'title type status')
    .sort({ createdAt: -1 }).lean();
  return { success: true, data: claims.map(safeClaim) };
}

export async function getClaimDetails(claimId, user) {
  const claim = await findClaim(claimId);
  if (!claim) notFound();
  if (user.role !== 'admin' && id(claim.claimant) !== id(user) && id(claim.itemOwner) !== id(user)) throw new AppError('You are not allowed to view this claim.', 403, 'FORBIDDEN');
  const populated = await Claim.findById(claimId).populate('claimant', 'name').populate('itemOwner', 'name').populate('item', 'title type status').lean();
  return { success: true, data: safeClaim(populated) };
}

export async function approveClaim(claimId, user) {
  const claim = await findClaim(claimId);
  if (!claim) notFound();
  ensurePending(claim);
  if (!canReview(claim, user)) throw new AppError('Only the item owner or an admin can review this claim.', 403, 'FORBIDDEN');
  if (id(claim.claimant) === id(user)) throw new AppError('You cannot approve your own claim.', 403, 'CANNOT_REVIEW_OWN_CLAIM');

  // The conditional item update is the single-winner gate for concurrent approvals.
  const resolvedItem = await Item.findOneAndUpdate(
    { _id: claim.item, status: 'active', isHidden: { $ne: true } },
    { $set: { status: 'resolved', resolvedByClaim: claim._id, resolvedAt: new Date() } },
    { new: true },
  ).lean();
  if (!resolvedItem) throw new AppError('This item is resolved or hidden and cannot be approved.', 409, 'ITEM_ALREADY_RESOLVED');

  const reviewedAt = new Date();
  const approved = await Claim.findOneAndUpdate({ _id: claim._id, status: 'pending' }, { $set: { status: 'approved', reviewedAt, reviewedBy: user._id || user.id, rejectionReason: '' } }, { new: true }).lean();
  if (!approved) {
    await Item.findOneAndUpdate({ _id: claim.item, status: 'resolved', resolvedByClaim: claim._id }, { $set: { status: 'active', resolvedAt: null }, $unset: { resolvedByClaim: 1 } }, { new: true });
    throw new AppError('This claim changed while it was being reviewed. Please reload and try again.', 409, 'CLAIM_STATE_CONFLICT');
  }
  const resolutionReason = 'Item has already been resolved through another approved claim.';
  await Claim.updateMany(
    { item: claim.item, _id: { $ne: claim._id }, status: 'pending' },
    { $set: { status: 'rejected', rejectionReason: resolutionReason, reviewedAt, reviewedBy: user._id || user.id } },
  );
  let rejected = [];
  try {
    rejected = await Claim.find({ item: claim.item, _id: { $ne: claim._id }, status: 'rejected', rejectionReason: resolutionReason, reviewedAt, reviewedBy: user._id || user.id }).select('_id claimant').lean();
  } catch (error) {
    console.warn('Could not find auto-rejected claims for notifications:', { name: error?.name || 'Error' });
  }
  await createNotifications([
    { recipient: id(claim.claimant), actorId: id(user), type: 'CLAIM_APPROVED', title: 'Your ownership claim was approved', message: 'Your claim was approved and the item is now resolved. Contact information is available to the approved participants.', relatedItem: id(claim.item), relatedClaim: id(claim._id), dedupeKey: `claim-approved:${id(claim._id)}` },
    ...rejected.map((entry) => ({ recipient: id(entry.claimant), actorId: id(user), type: 'CLAIM_REJECTED', title: 'Your ownership claim was not approved', message: 'This item was resolved through another approved claim.', relatedItem: id(claim.item), relatedClaim: id(entry._id), dedupeKey: `claim-resolved-reject:${id(entry._id)}` })),
  ]);
  try { if (mongoose.connection.readyState === 1) await Match.deleteMany({ $or: [{ sourceItem: claim.item }, { candidateItem: claim.item }] }); }
  catch (error) { console.warn('Could not remove matches after item resolution:', { name: error?.name || 'Error' }); }
  return { success: true, data: { id: id(approved), status: approved.status, reviewedAt: approved.reviewedAt } };
}

export async function rejectClaim(claimId, user, rejectionReason = '') {
  const claim = await findClaim(claimId);
  if (!claim) notFound();
  if (!canReview(claim, user)) throw new AppError('Only the item owner or an admin can review this claim.', 403, 'FORBIDDEN');
  if (id(claim.claimant) === id(user)) throw new AppError('You cannot reject your own claim.', 403, 'CANNOT_REVIEW_OWN_CLAIM');
  ensurePending(claim);
  const updated = await Claim.findOneAndUpdate({ _id: claim._id, status: 'pending' }, { $set: { status: 'rejected', reviewedAt: new Date(), reviewedBy: user._id || user.id, rejectionReason } }, { new: true }).lean();
  if (!updated) throw new AppError('This claim changed while it was being reviewed.', 409, 'CLAIM_STATE_CONFLICT');
  await createNotifications([{
    recipient: id(claim.claimant), actorId: id(user), type: 'CLAIM_REJECTED', title: 'Your ownership claim was rejected',
    message: 'The item owner reviewed your claim and did not approve it.', relatedItem: id(claim.item), relatedClaim: id(claim._id), dedupeKey: `claim-rejected:${id(claim._id)}`,
  }]);
  return { success: true, data: { id: id(updated), status: updated.status, reviewedAt: updated.reviewedAt } };
}

export async function cancelClaim(claimId, user) {
  const claim = await findClaim(claimId);
  if (!claim) notFound();
  if (id(claim.claimant) !== id(user)) throw new AppError('Only the claimant can cancel this claim.', 403, 'FORBIDDEN');
  ensurePending(claim);
  const updated = await Claim.findOneAndUpdate({ _id: claim._id, status: 'pending' }, { $set: { status: 'cancelled', reviewedAt: new Date(), reviewedBy: user._id || user.id } }, { new: true }).lean();
  if (!updated) throw new AppError('This claim changed while it was being cancelled.', 409, 'CLAIM_STATE_CONFLICT');
  await createNotifications([{
    recipient: id(claim.itemOwner), actorId: id(user), type: 'CLAIM_CANCELLED', title: 'An ownership claim was cancelled',
    message: 'A pending claim for your found item was cancelled by the claimant.', relatedItem: id(claim.item), relatedClaim: id(claim._id), dedupeKey: `claim-cancelled:${id(claim._id)}`,
  }]);
  return { success: true, data: { id: id(updated), status: updated.status, reviewedAt: updated.reviewedAt } };
}

export async function getClaimContact(claimId, user) {
  const claim = await findClaim(claimId);
  if (!claim) notFound();
  if (user.role !== 'admin' && id(claim.claimant) !== id(user) && id(claim.itemOwner) !== id(user)) throw new AppError('You are not allowed to access this contact information.', 403, 'FORBIDDEN');
  if (claim.status !== 'approved') throw new AppError('Contact information is available only after an approved claim.', 409, 'CONTACT_NOT_AVAILABLE');
  const contactId = user.role === 'admin' || id(claim.claimant) === id(user) ? claim.itemOwner : claim.claimant;
  const contact = await User.findById(contactId).select('name email').lean();
  if (!contact) throw new AppError('Contact information is unavailable.', 404, 'CONTACT_NOT_FOUND');
  return { success: true, data: { name: contact.name, email: contact.email } };
}
