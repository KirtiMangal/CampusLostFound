import { z } from 'zod';

const signal = z.string().trim().min(1).max(160);

export const geminiMatchResponseSchema = z.object({
  confidence: z.number().int().min(0).max(100),
  decision: z.enum(['possible_match', 'unlikely_match', 'insufficient_information']),
  reasoning: z.array(z.string().trim().min(1).max(300)).max(5),
  matchingSignals: z.array(signal).max(8),
  contradictingSignals: z.array(signal).max(8),
  missingInformation: z.array(signal).max(8),
}).strict();

export const geminiMatchJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    decision: { type: 'string', enum: ['possible_match', 'unlikely_match', 'insufficient_information'] },
    reasoning: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 300 } },
    matchingSignals: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 160 } },
    contradictingSignals: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 160 } },
    missingInformation: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 160 } },
  },
  required: ['confidence', 'decision', 'reasoning', 'matchingSignals', 'contradictingSignals', 'missingInformation'],
};
