import { z } from 'zod';

export const notificationIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict();
export const notificationInputSchema = z.object({
  recipient: z.string().regex(/^[a-f\d]{24}$/i),
  actorId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  type: z.enum(['MATCH_FOUND', 'CLAIM_RECEIVED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_CANCELLED', 'ITEM_RESOLVED', 'MODERATION_REPORT', 'ACCOUNT_REACTIVATED']),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  relatedItem: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  relatedMatch: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  relatedClaim: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  relatedReport: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  dedupeKey: z.string().trim().min(1).max(240).optional(),
}).strict();
