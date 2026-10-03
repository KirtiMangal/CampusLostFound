import { z } from 'zod';
import { REPORT_PRIORITIES, REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES } from '../models/Report.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Enter a valid ID.');

export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(1000, 'Description must be 1,000 characters or fewer.').optional().default(''),
}).strict();

export const reportIdSchema = objectId;
export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(REPORT_STATUSES).optional(),
  priority: z.enum(REPORT_PRIORITIES).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
  autoFlagged: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['newest', 'priority']).default('newest'),
}).strict();

export const reviewReportSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  priority: z.enum(REPORT_PRIORITIES).optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
  itemAction: z.enum(['hide', 'unhide']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'Choose a moderation change.' });

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  role: z.enum(['student', 'admin']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
}).strict();

export const userIdSchema = objectId;
export const suspensionSchema = z.object({ reason: z.string().trim().min(5, 'Provide a reason with at least 5 characters.').max(500) }).strict();
export const itemModerationSchema = z.object({ action: z.enum(['hide', 'unhide']) }).strict();
