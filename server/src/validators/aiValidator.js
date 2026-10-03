import { z } from 'zod';
import { ITEM_CATEGORIES, ITEM_TYPES } from '../../../shared/itemConstants.js';

export const describeRequestSchema = z.object({
  type: z.enum(ITEM_TYPES, { errorMap: () => ({ message: 'Type must be lost or found.' }) }),
  category: z.enum(ITEM_CATEGORIES, { errorMap: () => ({ message: 'Choose a supported category.' }) }).optional(),
  title: z.string().trim().max(120, 'Title must be 120 characters or fewer.').optional(),
  roughDescription: z.string().trim().min(1, 'Enter a rough description first.').max(2000, 'Description must be 2,000 characters or fewer.'),
  location: z.string().trim().max(120, 'Location must be 120 characters or fewer.').optional(),
  date: z.string().date('Enter a valid date.').optional(),
}).strict();

const shortText = z.string().trim().min(1).max(120);
export const describeResponseSchema = z.object({
  suggestedTitle: shortText,
  suggestedDescription: z.string().trim().min(1).max(2000),
  keywords: z.array(z.string().trim().min(1).max(60)).max(10),
  suggestedCategory: z.enum(ITEM_CATEGORIES),
  clarifyingQuestions: z.array(z.string().trim().min(1).max(200)).max(5),
}).strict();

export const describeResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestedTitle: { type: 'string', minLength: 1, maxLength: 120 },
    suggestedDescription: { type: 'string', minLength: 1, maxLength: 2000 },
    keywords: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 60 } },
    suggestedCategory: { type: 'string', enum: ITEM_CATEGORIES },
    clarifyingQuestions: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 200 } },
  },
  required: ['suggestedTitle', 'suggestedDescription', 'keywords', 'suggestedCategory', 'clarifyingQuestions'],
};
