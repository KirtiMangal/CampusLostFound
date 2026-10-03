import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Item from '../src/models/Item.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'test-only-secret';

const OWNER_ID = '64b000000000000000000001';
const OTHER_ID = '64b000000000000000000002';
const ITEM_ID = '64b000000000000000000010';
const userRecord = (id = OWNER_ID, role = 'student') => ({
  _id: new mongoose.Types.ObjectId(id),
  id,
  name: role === 'admin' ? 'Campus Admin' : 'Kirti Mangal',
  email: `${role}@example.edu`,
  role,
  isActive: true,
});

function authorize(t, id = OWNER_ID, role = 'student') {
  const user = userRecord(id, role);
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return { header: `Bearer ${jwt.sign({ userId: id, role }, process.env.JWT_SECRET)}`, user };
}

function bearer(id, role) {
  return `Bearer ${jwt.sign({ userId: id, role }, process.env.JWT_SECRET)}`;
}

function itemRecord(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(ITEM_ID),
    title: 'Black Lenovo Laptop',
    description: 'Black Lenovo laptop with a small sticker near the keyboard.',
    category: 'Electronics',
    type: 'lost',
    location: 'Library',
    date: new Date('2026-10-01T00:00:00.000Z'),
    status: 'active',
    images: [],
    owner: { _id: new mongoose.Types.ObjectId(OWNER_ID), name: 'Kirti Mangal', email: 'private@example.edu', password: 'private-hash' },
    createdAt: new Date('2026-10-02T12:00:00.000Z'),
    updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    async populate() { return this; },
    set(values) { Object.assign(this, values); },
    async save() { this.updatedAt = new Date(); return this; },
    async deleteOne() { this.wasDeleted = true; },
    ...overrides,
  };
}

const createBody = {
  title: 'Black Lenovo Laptop',
  description: 'Black Lenovo laptop with a small sticker near the keyboard.',
  category: 'Electronics',
  type: 'lost',
  location: 'Library',
  date: '2026-10-01',
};

test('requires authentication to create an item', async () => {
  const response = await request(createApp()).post('/api/items').send(createBody);
  assert.equal(response.status, 401);
});

test('creates an item for the authenticated owner and rejects client-supplied ownership', async (t) => {
  const { header, user } = authorize(t);
  let created;
  t.mock.method(Item, 'create', async (values) => {
    created = values;
    const item = itemRecord({ ...values, _id: new mongoose.Types.ObjectId(ITEM_ID) });
    item.populate = async function populateOwner() {
      this.owner = { _id: user._id, name: user.name, email: user.email, password: 'private-hash' };
      return this;
    };
    return item;
  });

  const response = await request(createApp()).post('/api/items').set('Authorization', header).send(createBody);
  assert.equal(response.status, 201);
  assert.equal(created.owner.toString(), user._id.toString());
  assert.equal(created.status, undefined);
  assert.deepEqual(created.images, []);
  assert.equal(response.body.item.status, 'active');
  assert.deepEqual(response.body.item.images, []);
  assert.deepEqual(response.body.item.owner, { id: OWNER_ID, name: 'Kirti Mangal' });
  assert.equal('email' in response.body.item.owner, false);
  assert.equal('password' in response.body.item.owner, false);

  const ownerOverride = await request(createApp()).post('/api/items').set('Authorization', header).send({ ...createBody, owner: OTHER_ID });
  assert.equal(ownerOverride.status, 400);

  const foundResponse = await request(createApp()).post('/api/items').set('Authorization', header).send({ ...createBody, type: 'found' });
  assert.equal(foundResponse.status, 201);
  assert.equal(created.type, 'found');
  assert.equal(foundResponse.body.item.type, 'found');
});

test('rejects invalid item data', async (t) => {
  const { header } = authorize(t);
  const response = await request(createApp()).post('/api/items').set('Authorization', header).send({ ...createBody, category: 'Invalid', type: 'maybe', date: 'not-a-date' });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('rejects unknown and Mongo operator item-list query parameters', async (t) => {
  const { header } = authorize(t);
  const response = await request(createApp()).get('/api/items').query({ '$where': 'this.status === "active"' }).set('Authorization', header);
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('lists filtered and searched items with safe owners and pagination', async (t) => {
  const { header } = authorize(t);
  const item = itemRecord();
  let filter;
  let sort;
  let skipped;
  let limited;
  const query = {
    populate() { return this; },
    sort(value) { sort = value; return this; },
    skip(value) { skipped = value; return this; },
    limit(value) { limited = value; return this; },
    lean: async () => [item],
  };
  t.mock.method(Item, 'find', (value) => { filter = value; return query; });
  t.mock.method(Item, 'countDocuments', async () => 12);

  const response = await request(createApp()).get('/api/items?type=lost&category=Electronics&location=Library&status=active&search=laptop&page=2&limit=5&sort=oldest&mine=true').set('Authorization', header);
  assert.equal(response.status, 200);
  assert.equal(filter.type, 'lost');
  assert.equal(filter.category, 'Electronics');
  assert.equal(filter.status, 'active');
  assert.equal(filter.owner.toString(), OWNER_ID);
  assert.equal(filter.location.test('library'), true);
  assert.deepEqual(filter.$text, { $search: 'laptop' });
  assert.deepEqual(sort, { date: 1, createdAt: 1 });
  assert.equal(skipped, 5);
  assert.equal(limited, 5);
  assert.deepEqual(response.body.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
  assert.deepEqual(response.body.items[0].owner, { id: OWNER_ID, name: 'Kirti Mangal' });
  assert.equal('email' in response.body.items[0].owner, false);

  const defaultList = await request(createApp()).get('/api/items').set('Authorization', header);
  assert.deepEqual(filter, { isHidden: { $ne: true } });
  assert.deepEqual(sort, { date: -1, createdAt: -1 });
  assert.equal(skipped, 0);
  assert.equal(limited, 10);
  assert.deepEqual(defaultList.body.pagination, { page: 1, limit: 10, total: 12, totalPages: 2 });
});

test('limits pagination and validates filter values', async (t) => {
  const { header } = authorize(t);
  const response = await request(createApp()).get('/api/items?limit=500&type=unknown').set('Authorization', header);
  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('gets one item, returns 400 for invalid IDs, and 404 when an item is missing', async (t) => {
  const { header } = authorize(t);
  const item = itemRecord();
  t.mock.method(Item, 'findById', (id) => ({
    populate() { return this; },
    lean: async () => id === ITEM_ID ? item : null,
  }));

  const found = await request(createApp()).get(`/api/items/${ITEM_ID}`).set('Authorization', header);
  const invalid = await request(createApp()).get('/api/items/not-an-id').set('Authorization', header);
  const missing = await request(createApp()).get('/api/items/64b000000000000000000099').set('Authorization', header);
  assert.equal(found.status, 200);
  assert.equal(found.body.item.title, 'Black Lenovo Laptop');
  assert.deepEqual(found.body.item.owner, { id: OWNER_ID, name: 'Kirti Mangal' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'INVALID_ITEM_ID');
  assert.equal(missing.status, 404);
});

test('allows the owner to update a report', async (t) => {
  const { header } = authorize(t);
  const item = itemRecord();
  t.mock.method(Item, 'findById', async () => item);
  const response = await request(createApp()).put(`/api/items/${ITEM_ID}`).set('Authorization', header).send({ title: 'Updated laptop report', status: 'resolved' });
  assert.equal(response.status, 200);
  assert.equal(response.body.item.title, 'Updated laptop report');
  assert.equal(response.body.item.status, 'resolved');
});

test('does not allow clients to change item ownership or creation timestamps', async (t) => {
  const { header } = authorize(t);
  const item = itemRecord();
  t.mock.method(Item, 'findById', async () => item);
  const ownerChange = await request(createApp()).put(`/api/items/${ITEM_ID}`).set('Authorization', header).send({ owner: OTHER_ID });
  const createdAtChange = await request(createApp()).put(`/api/items/${ITEM_ID}`).set('Authorization', header).send({ createdAt: '2020-01-01T00:00:00.000Z' });
  assert.equal(ownerChange.status, 400);
  assert.equal(createdAtChange.status, 400);
  assert.equal(item.owner._id.toString(), OWNER_ID);
});

test('prevents another student from updating an item but allows an admin', async (t) => {
  let authUser = userRecord(OTHER_ID, 'student');
  t.mock.method(User, 'findById', () => ({ select: async () => authUser }));
  const studentHeader = bearer(OTHER_ID, 'student');
  let item = itemRecord();
  t.mock.method(Item, 'findById', async () => item);
  const forbidden = await request(createApp()).put(`/api/items/${ITEM_ID}`).set('Authorization', studentHeader).send({ location: 'Student center' });
  assert.equal(forbidden.status, 403);

  authUser = userRecord(OTHER_ID, 'admin');
  const adminHeader = bearer(OTHER_ID, 'admin');
  item = itemRecord();
  const allowed = await request(createApp()).put(`/api/items/${ITEM_ID}`).set('Authorization', adminHeader).send({ location: 'Student center' });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.item.location, 'Student center');
});

test('allows the owner to delete a report', async (t) => {
  const { header } = authorize(t);
  const item = itemRecord();
  t.mock.method(Item, 'findById', async () => item);
  const response = await request(createApp()).delete(`/api/items/${ITEM_ID}`).set('Authorization', header);
  assert.equal(response.status, 200);
  assert.equal(item.wasDeleted, true);
});

test('prevents another student from deleting an item but allows an admin', async (t) => {
  let authUser = userRecord(OTHER_ID, 'student');
  t.mock.method(User, 'findById', () => ({ select: async () => authUser }));
  const studentHeader = bearer(OTHER_ID, 'student');
  let item = itemRecord();
  t.mock.method(Item, 'findById', async () => item);
  const forbidden = await request(createApp()).delete(`/api/items/${ITEM_ID}`).set('Authorization', studentHeader);
  assert.equal(forbidden.status, 403);
  assert.equal(item.wasDeleted, undefined);

  authUser = userRecord(OTHER_ID, 'admin');
  const adminHeader = bearer(OTHER_ID, 'admin');
  item = itemRecord();
  const allowed = await request(createApp()).delete(`/api/items/${ITEM_ID}`).set('Authorization', adminHeader);
  assert.equal(allowed.status, 200);
  assert.equal(item.wasDeleted, true);
});
