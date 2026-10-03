import { z } from 'zod';
import { ITEM_CATEGORIES, ITEM_STATUSES, ITEM_TYPES } from '../../../shared/itemConstants.js';

const title = z.string().trim().min(1, 'Enter an item title.').max(120, 'Title must be 120 characters or fewer.');
const description = z.string().trim().min(1, 'Enter a description.').max(2000, 'Description must be 2,000 characters or fewer.');
const category = z.enum(ITEM_CATEGORIES, { errorMap: () => ({ message: 'Choose a valid category.' }) });
const type = z.enum(ITEM_TYPES, { errorMap: () => ({ message: 'Type must be lost or found.' }) });
const location = z.string().trim().min(1, 'Enter a campus location.').max(120, 'Location must be 120 characters or fewer.');
const date = z.string().date('Enter a valid date.').transform((value) => new Date(`${value}T00:00:00.000Z`));
const status = z.enum(ITEM_STATUSES, { errorMap: () => ({ message: 'Status must be active or resolved.' }) });

export const createItemSchema = z.object({ title, description, category, type, location, date }).strict();
export const updateItemSchema = z.object({
  title, description, category, type, location, date, status,
  removeImages: z.array(z.string().trim().min(1).max(255)).max(5).optional(),
}).partial().strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update.' });
export const itemIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid item ID.');

export const itemListQuerySchema = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  mine: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).strict();
