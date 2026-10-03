import Item from '../models/Item.js';
import Match from '../models/Match.js';
import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { deleteImages, uploadImage } from './cloudinaryService.js';

const MAX_IMAGES = 5;

function idString(value) {
  if (value && value._id) return value._id.toString();
  return value?.toString?.() || '';
}

function publicItem(item) {
  const owner = item.owner;
  const date = item.date instanceof Date ? item.date.toISOString().slice(0, 10) : String(item.date).slice(0, 10);
  return {
    id: idString(item),
    title: item.title,
    description: item.description,
    category: item.category,
    type: item.type,
    location: item.location,
    date,
    status: item.status,
    isHidden: item.isHidden === true,
    images: (item.images || []).map((image) => typeof image === 'string'
      ? { url: image, publicId: null }
      : { url: image?.url, publicId: image?.publicId }).filter((image) => image.url),
    owner: owner ? { id: idString(owner), ...(owner.name ? { name: owner.name } : {}) } : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function uploadFiles(files) {
  if (!files.length) return [];
  const results = await Promise.allSettled(files.map((file) => uploadImage(file.buffer)));
  const uploaded = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    await deleteImages(uploaded);
    if (failed.reason?.statusCode) throw failed.reason;
    throw new AppError('One or more images could not be uploaded. Please try again.', 502, 'IMAGE_UPLOAD_FAILED');
  }
  return uploaded;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureValidId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid item ID.', 400, 'INVALID_ITEM_ID');
}

function ensureFound(item) {
  if (!item) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  return item;
}

function ensureCanManage(item, user) {
  if (user.role !== 'admin' && idString(item.owner) !== idString(user)) {
    throw new AppError('You can only manage your own reports.', 403, 'FORBIDDEN');
  }
}

export async function createItem(data, user, files = []) {
  const images = await uploadFiles(files);
  let item;
  try {
    item = await Item.create({ ...data, images, owner: user._id });
  } catch (error) {
    await deleteImages(images);
    throw error;
  }
  await item.populate('owner', 'name');
  return publicItem(item);
}

export async function listItems(query, user) {
  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.location) filter.location = new RegExp(`^${escapeRegex(query.location)}$`, 'i');
  if (query.search) filter.$text = { $search: query.search };
  if (query.mine) filter.owner = user._id;
  if (user.role !== 'admin' && !query.mine) filter.isHidden = { $ne: true };

  const skip = (query.page - 1) * query.limit;
  const sort = query.sort === 'oldest' ? { date: 1, createdAt: 1 } : { date: -1, createdAt: -1 };
  const [items, total] = await Promise.all([
    Item.find(filter).populate('owner', 'name').sort(sort).skip(skip).limit(query.limit).lean(),
    Item.countDocuments(filter),
  ]);

  return {
    items: items.map(publicItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getItem(id, user) {
  ensureValidId(id);
  const item = await Item.findById(id).populate('owner', 'name').lean();
  const found = ensureFound(item);
  if (found.isHidden && user.role !== 'admin' && idString(found.owner) !== idString(user)) throw new AppError('Item not found.', 404, 'ITEM_NOT_FOUND');
  return publicItem(found);
}

export async function updateItem(id, data, user, files = []) {
  ensureValidId(id);
  const item = ensureFound(await Item.findById(id));
  ensureCanManage(item, user);
  const currentImages = (item.images || []).map((image) => typeof image === 'string'
    ? { url: image, publicId: null }
    : { url: image?.url, publicId: image?.publicId }).filter((image) => image.url);
  const removeIds = [...new Set(data.removeImages || [])];
  const removedImages = currentImages.filter((image) => image.publicId && removeIds.includes(image.publicId));
  if (removedImages.length !== removeIds.length) throw new AppError('One or more images do not belong to this item.', 400, 'INVALID_IMAGE_REMOVAL');
  const remainingImages = currentImages.filter((image) => !removeIds.includes(image.publicId));
  if (remainingImages.length + files.length > MAX_IMAGES) {
    throw new AppError('An item can have no more than 5 images.', 400, 'TOO_MANY_IMAGES');
  }

  const newImages = await uploadFiles(files);
  const itemFields = { ...data };
  delete itemFields.removeImages;
  if (data.status === 'resolved' && item.status !== 'resolved') itemFields.resolvedAt = new Date();
  else if (data.status === 'active' && item.status !== 'active') itemFields.resolvedAt = null;
  item.set({ ...itemFields, images: [...remainingImages, ...newImages] });
  try {
    await item.save();
  } catch (error) {
    await deleteImages(newImages);
    throw error;
  }
  // The database reference is removed first. A failed Cloudinary delete leaves
  // an orphan asset, which is logged for operational cleanup without restoring
  // a broken reference in the item document.
  await deleteImages(removedImages);
  await item.populate('owner', 'name');
  return publicItem(item);
}

export async function deleteItem(id, user) {
  ensureValidId(id);
  const item = ensureFound(await Item.findById(id));
  ensureCanManage(item, user);
  const images = (item.images || []).map((image) => typeof image === 'string' ? { url: image, publicId: null } : image);
  await item.deleteOne();
  try { if (mongoose.connection.readyState === 1) await Match.deleteMany({ $or: [{ sourceItem: item._id }, { candidateItem: item._id }] }); }
  catch (error) { console.warn('Could not remove matches for deleted item:', { name: error?.name || 'Error' }); }
  await deleteImages(images);
}

export const itemServiceInternals = { publicItem, escapeRegex, ensureCanManage };
