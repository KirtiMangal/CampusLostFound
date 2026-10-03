import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Writable } from 'node:stream';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import { createApp } from '../src/app.js';
import Item from '../src/models/Item.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'test-only-secret';
const OWNER = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';
const ITEM = '64b000000000000000000010';
const base = { title: 'Black laptop', description: 'Black laptop with sticker.', category: 'Electronics', type: 'lost', location: 'Library', date: '2026-10-01' };
const user = (id = OWNER, role = 'student') => ({ _id: new mongoose.Types.ObjectId(id), id, name: 'Campus User', role, isActive: true });

function authorize(t, id = OWNER, role = 'student') {
  const current = user(id, role);
  t.mock.method(User, 'findById', () => ({ select: async () => current }));
  return jwt.sign({ userId: id, role }, process.env.JWT_SECRET);
}

function record(values = {}) {
  return {
    _id: new mongoose.Types.ObjectId(ITEM), owner: { _id: new mongoose.Types.ObjectId(OWNER), name: 'Campus User' },
    ...base, status: 'active', images: [], createdAt: new Date(), updatedAt: new Date(), ...values,
    async populate() { return this; }, set(update) { Object.assign(this, update); },
    async save() { return this; }, async deleteOne() { this.deleted = true; },
  };
}

function mockCloudinary(t) {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const deleted = [];
  let uploaded = 0;
  t.mock.method(cloudinary.uploader, 'upload_stream', (_options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      const index = uploaded++;
      callback(null, { secure_url: `https://res.cloudinary.com/test/image/upload/${index}.jpg`, public_id: `campusfind/items/${index}` });
      done();
    },
  }));
  t.mock.method(cloudinary.uploader, 'destroy', async (publicId) => { deleted.push(publicId); return { result: 'ok' }; });
  return { deleted, get uploaded() { return uploaded; } };
}

const fixtures = {
  jpeg: { filename: 'photo.jpg', contentType: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  png: { filename: 'photo.png', contentType: 'image/png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  webp: { filename: 'photo.webp', contentType: 'image/webp', data: Buffer.from('RIFF0000WEBP') },
};

function createRequest(header) {
  const call = request(createApp()).post('/api/items').set('Authorization', `Bearer ${header}`);
  for (const [key, value] of Object.entries(base)) call.field(key, value);
  return call;
}

test('accepts JPEG, PNG, and WebP, uploads multiple images, and stores only Cloudinary references', async (t) => {
  const header = authorize(t);
  const cloud = mockCloudinary(t);
  let createdValues;
  t.mock.method(Item, 'create', async (values) => {
    createdValues = values;
    return record({ ...values, async populate() { this.owner = { _id: user()._id, name: 'Campus User' }; return this; } });
  });

  const call = createRequest(header);
  for (const file of Object.values(fixtures)) call.attach('images', file.data, { filename: file.filename, contentType: file.contentType });
  const response = await call;
  assert.equal(response.status, 201);
  assert.equal(cloud.uploaded, 3);
  assert.deepEqual(createdValues.images.map(({ publicId }) => publicId), ['campusfind/items/0', 'campusfind/items/1', 'campusfind/items/2']);
  assert.deepEqual(response.body.item.images, createdValues.images);
});

test('cleans up successfully uploaded assets when a parallel Cloudinary upload fails', async (t) => {
  const header = authorize(t);
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const deleted = [];
  let sequence = 0;
  t.mock.method(cloudinary.uploader, 'upload_stream', (_options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      const current = sequence++;
      if (current === 0) callback(null, { secure_url: 'https://image/ok.jpg', public_id: 'campusfind/items/ok' });
      else callback(new Error('Cloudinary unavailable'));
      done();
    },
  }));
  t.mock.method(cloudinary.uploader, 'destroy', async (id) => { deleted.push(id); return { result: 'ok' }; });
  const create = t.mock.method(Item, 'create', async () => { throw new Error('Database should not be written.'); });
  const response = await createRequest(header)
    .attach('images', fixtures.jpeg.data, { filename: 'one.jpg', contentType: 'image/jpeg' })
    .attach('images', fixtures.png.data, { filename: 'two.png', contentType: 'image/png' });
  assert.equal(response.status, 502);
  assert.equal(response.body.code, 'IMAGE_UPLOAD_FAILED');
  assert.equal(create.mock.callCount(), 0);
  assert.deepEqual(deleted, ['campusfind/items/ok']);
});

test('cleans up uploaded assets when item persistence fails', async (t) => {
  const header = authorize(t);
  const cloud = mockCloudinary(t);
  t.mock.method(Item, 'create', async () => { throw new Error('database write failed'); });
  const response = await createRequest(header).attach('images', fixtures.jpeg.data, { filename: 'one.jpg', contentType: 'image/jpeg' });
  assert.equal(response.status, 500);
  assert.deepEqual(cloud.deleted, ['campusfind/items/0']);
});

test('rejects unsupported formats, MIME spoofing, files above 5 MB, and more than five files', async (t) => {
  const header = authorize(t);
  const pdf = await createRequest(header).attach('images', Buffer.from('%PDF-1.7'), { filename: 'notes.pdf', contentType: 'application/pdf' });
  assert.equal(pdf.status, 400);
  assert.equal(pdf.body.code, 'INVALID_IMAGE_TYPE');

  const spoof = await createRequest(header).attach('images', Buffer.from('%PDF-1.7'), { filename: 'picture.png', contentType: 'image/png' });
  assert.equal(spoof.status, 400);
  assert.equal(spoof.body.code, 'INVALID_IMAGE_TYPE');

  const large = await createRequest(header).attach('images', Buffer.alloc(5 * 1024 * 1024 + 1, 0), { filename: 'large.png', contentType: 'image/png' });
  assert.equal(large.status, 400);
  assert.equal(large.body.code, 'IMAGE_TOO_LARGE');

  const manyRequest = createRequest(header);
  for (let index = 0; index < 6; index++) manyRequest.attach('images', fixtures.jpeg.data, { filename: `${index}.jpg`, contentType: 'image/jpeg' });
  const many = await manyRequest;
  assert.equal(many.status, 400);
  assert.equal(many.body.code, 'TOO_MANY_IMAGES');
});

test('requires authentication before accepting an upload', async () => {
  const response = await createRequest('').unset('Authorization').attach('images', fixtures.jpeg.data, { filename: 'photo.jpg', contentType: 'image/jpeg' });
  assert.equal(response.status, 401);
});

test('adds images and removes only references already attached to the item', async (t) => {
  const header = authorize(t);
  const cloud = mockCloudinary(t);
  const existing = [0, 1, 2, 3].map((index) => ({ url: `https://image/${index}.jpg`, publicId: `campusfind/items/old-${index}` }));
  const item = record({ images: existing });
  t.mock.method(Item, 'findById', async () => item);
  const response = await request(createApp()).put(`/api/items/${ITEM}`).set('Authorization', `Bearer ${header}`)
    .field('removeImages', JSON.stringify(['campusfind/items/old-0']))
    .attach('images', fixtures.webp.data, { filename: 'new.webp', contentType: 'image/webp' });
  assert.equal(response.status, 200);
  assert.equal(item.images.length, 4);
  assert.deepEqual(item.images.slice(0, 3), existing.slice(1));
  assert.deepEqual(cloud.deleted, ['campusfind/items/old-0']);
  assert.equal(response.body.item.images[3].publicId, 'campusfind/items/0');
});

test('rejects updates that would exceed five total images and rejects unknown public IDs', async (t) => {
  const header = authorize(t);
  const cloud = mockCloudinary(t);
  const item = record({ images: Array.from({ length: 5 }, (_, index) => ({ url: `https://image/${index}`, publicId: `campusfind/items/${index}` })) });
  t.mock.method(Item, 'findById', async () => item);
  const tooMany = await request(createApp()).put(`/api/items/${ITEM}`).set('Authorization', `Bearer ${header}`)
    .attach('images', fixtures.jpeg.data, { filename: 'sixth.jpg', contentType: 'image/jpeg' });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.code, 'TOO_MANY_IMAGES');
  assert.equal(cloud.uploaded, 0);

  const unknown = await request(createApp()).put(`/api/items/${ITEM}`).set('Authorization', `Bearer ${header}`).send({ removeImages: ['some/other/user/image'] });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.code, 'INVALID_IMAGE_REMOVAL');
});

test('only the owner or an admin can change image references', async (t) => {
  let authUser = user(OTHER, 'student');
  t.mock.method(User, 'findById', () => ({ select: async () => authUser }));
  const item = record({ images: [{ url: 'https://image/owned.jpg', publicId: 'campusfind/items/owned' }] });
  t.mock.method(Item, 'findById', async () => item);
  const header = jwt.sign({ userId: OTHER, role: 'student' }, process.env.JWT_SECRET);
  const denied = await request(createApp()).put(`/api/items/${ITEM}`).set('Authorization', `Bearer ${header}`).send({ removeImages: ['campusfind/items/owned'] });
  assert.equal(denied.status, 403);

  mockCloudinary(t);
  authUser = user(OTHER, 'admin');
  const adminHeader = jwt.sign({ userId: OTHER, role: 'admin' }, process.env.JWT_SECRET);
  const allowed = await request(createApp()).put(`/api/items/${ITEM}`).set('Authorization', `Bearer ${adminHeader}`).send({ removeImages: ['campusfind/items/owned'] });
  assert.equal(allowed.status, 200);
  assert.deepEqual(item.images, []);
});

test('item deletion attempts cleanup of associated Cloudinary assets', async (t) => {
  const header = authorize(t);
  const cloud = mockCloudinary(t);
  const item = record({ images: [{ url: 'https://image/a.jpg', publicId: 'campusfind/items/a' }, { url: 'https://image/b.jpg', publicId: 'campusfind/items/b' }] });
  t.mock.method(Item, 'findById', async () => item);
  const response = await request(createApp()).delete(`/api/items/${ITEM}`).set('Authorization', `Bearer ${header}`);
  assert.equal(response.status, 200);
  assert.equal(item.deleted, true);
  assert.deepEqual(cloud.deleted, ['campusfind/items/a', 'campusfind/items/b']);
});
