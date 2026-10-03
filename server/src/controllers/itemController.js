import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createItemSchema, itemIdSchema, itemListQuerySchema, updateItemSchema } from '../validators/itemValidator.js';
import { createItem as createItemRecord, deleteItem as deleteItemRecord, getItem as getItemRecord, listItems as listItemRecords, updateItem as updateItemRecord } from '../services/itemService.js';
import { getMatchesForItem, scheduleMatchGeneration } from '../services/matchingService.js';

function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError('Please check the submitted item data.', 400, 'VALIDATION_ERROR', result.error.flatten());
  return result.data;
}

function parseId(id) {
  const result = itemIdSchema.safeParse(id);
  if (!result.success) throw new AppError('Invalid item ID.', 400, 'INVALID_ITEM_ID');
  return result.data;
}

export const createItem = asyncHandler(async (req, res) => {
  const data = parseInput(createItemSchema, req.body);
  const item = await createItemRecord(data, req.user, req.files || []);
  if (!req.matchingRateLimited) scheduleMatchGeneration(item.id);
  res.status(201).json({ item });
});

export const listItems = asyncHandler(async (req, res) => {
  const query = parseInput(itemListQuerySchema, req.query);
  res.json(await listItemRecords(query, req.user));
});

export const getItem = asyncHandler(async (req, res) => {
  const item = await getItemRecord(parseId(req.params.id), req.user);
  res.json({ item });
});

export const updateItem = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (typeof body.removeImages === 'string') {
    try { body.removeImages = JSON.parse(body.removeImages); }
    catch { throw new AppError('Image removal data is invalid.', 400, 'VALIDATION_ERROR'); }
  }
  // An image-only multipart request is a valid update even when no text fields
  // or removals are present.
  const data = req.files?.length && Object.keys(body).length === 0 ? {} : parseInput(updateItemSchema, body);
  const item = await updateItemRecord(parseId(req.params.id), data, req.user, req.files || []);
  if (!req.matchingRateLimited && ['title', 'description', 'category', 'location', 'date', 'type', 'status'].some((field) => Object.hasOwn(data, field))) {
    scheduleMatchGeneration(item.id, { force: true });
  }
  res.json({ item });
});

export const getItemMatches = asyncHandler(async (req, res) => {
  res.json(await getMatchesForItem(parseId(req.params.id), req.user));
});

export const deleteItem = asyncHandler(async (req, res) => {
  await deleteItemRecord(parseId(req.params.id), req.user);
  res.json({ message: 'Item deleted.' });
});
