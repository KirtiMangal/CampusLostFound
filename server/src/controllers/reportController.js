import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createReportSchema } from '../validators/reportValidator.js';
import { createReport as createReportRecord } from '../services/moderationService.js';

export const createReport = asyncHandler(async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError('Please check the report details.', 400, 'REPORT_VALIDATION_ERROR', parsed.error.flatten());
  const result = await createReportRecord(req.user._id, parsed.data);
  res.status(201).json(result);
});
