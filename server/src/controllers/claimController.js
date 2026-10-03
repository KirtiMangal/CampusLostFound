import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { claimIdSchema, createClaimSchema, rejectClaimSchema } from '../validators/claimValidator.js';
import { approveClaim, cancelClaim, createClaim as createClaimRecord, getClaimContact, getClaimDetails, listClaimsForItem, listMyClaims, rejectClaim } from '../services/claimService.js';

function parse(schema, input, code = 'CLAIM_INVALID') {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('Please check the submitted claim data.', 400, code, result.error.flatten());
  return result.data;
}
function parseClaimId(value) {
  const result = claimIdSchema.safeParse(value);
  if (!result.success) throw new AppError('Invalid claim ID.', 400, 'INVALID_CLAIM_ID');
  return result.data;
}

export const createClaim = asyncHandler(async (req, res) => {
  const data = parse(createClaimSchema, req.body);
  const claim = await createClaimRecord(req.params.itemId, req.user, data);
  res.status(201).json({ success: true, data: claim });
});
export const listItemClaims = asyncHandler(async (req, res) => res.json(await listClaimsForItem(req.params.itemId, req.user)));
export const myClaims = asyncHandler(async (req, res) => res.json(await listMyClaims(req.user)));
export const receivedClaims = asyncHandler(async (req, res) => res.json(await listMyClaims(req.user, true)));
export const claimDetails = asyncHandler(async (req, res) => res.json(await getClaimDetails(parseClaimId(req.params.claimId), req.user)));
export const claimContact = asyncHandler(async (req, res) => res.json(await getClaimContact(parseClaimId(req.params.claimId), req.user)));
export const approve = asyncHandler(async (req, res) => res.json(await approveClaim(parseClaimId(req.params.claimId), req.user)));
export const reject = asyncHandler(async (req, res) => {
  const { rejectionReason } = parse(rejectClaimSchema, req.body || {});
  res.json(await rejectClaim(parseClaimId(req.params.claimId), req.user, rejectionReason));
});
export const cancel = asyncHandler(async (req, res) => res.json(await cancelClaim(parseClaimId(req.params.claimId), req.user)));
