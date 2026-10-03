import { z } from 'zod';
import { ITEM_CATEGORIES } from '../../../shared/itemConstants.js';

const title = z.string().trim().min(1, 'Enter an item title.').max(120, 'Title must be 120 characters or fewer.');
const description = z.string().trim().min(1, 'Add a few details to help identify the item.').max(2000, 'Description must be 2,000 characters or fewer.');
const category = z.string().refine((value) => ITEM_CATEGORIES.includes(value), 'Choose a category.');
const location = z.string().trim().min(1, 'Enter a campus location.').max(120, 'Location must be 120 characters or fewer.');
const date = z.string().date('Choose a valid date.');

export function reportSchema(type) {
  return z.object({ title, description, category, location, date, type: z.literal(type) });
}

export const editItemSchema = z.object({
  title,
  description,
  category,
  location,
  date,
  type: z.enum(['lost', 'found']),
  status: z.enum(['active', 'resolved']),
});
