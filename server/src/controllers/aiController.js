import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { describeItem } from '../services/geminiService.js';
import { describeRequestSchema } from '../validators/aiValidator.js';

export const describeItemController = asyncHandler(async (req, res) => {
  const result = describeRequestSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError('Please add a short description and check the supplied item details.', 400, 'AI_INPUT_INVALID', result.error.flatten());
  }
  const data = await describeItem(result.data);
  res.json({ success: true, data });
});
