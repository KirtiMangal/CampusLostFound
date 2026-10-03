import { z } from 'zod';

export const claimIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const createClaimSchema = z.object({ claimMessage: z.string().trim().min(1).max(2000) }).strict();
export const rejectClaimSchema = z.object({ rejectionReason: z.string().trim().max(300).optional().default('') }).strict();
