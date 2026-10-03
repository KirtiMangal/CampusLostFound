import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Claim from '../src/models/Claim.js';
import Item from '../src/models/Item.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'claim-test-secret';
const OWNER = '64b000000000000000000071';
const CLAIMANT = '64b000000000000000000072';
const ITEM = '64b000000000000000000073';

function authorize(t, userId = CLAIMANT, role = 'student') {
  const user = { _id: new mongoose.Types.ObjectId(userId), id: userId, name: 'Test User', email: 'test@example.edu', role, isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}`;
}

test('requires authentication, validates claim text, and creates an active found-item claim', async (t) => {
  const app = createApp();
  const unauthenticated = await request(app).post(`/api/items/${ITEM}/claims`).send({ claimMessage: 'It is mine.' });
  assert.equal(unauthenticated.status, 401);
  const token = authorize(t);
  const invalid = await request(app).post(`/api/items/${ITEM}/claims`).set('Authorization', token).send({ claimMessage: '  ' });
  assert.equal(invalid.status, 400);

  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER), type: 'found', status: 'active' }) }) }));
  t.mock.method(Claim, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(Claim, 'create', async (data) => ({ _id: new mongoose.Types.ObjectId('64b000000000000000000074'), status: 'pending', ...data }));
  const response = await request(app).post(`/api/items/${ITEM}/claims`).set('Authorization', token).send({ claimMessage: 'Blue stitched tag on the inner pocket.' });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { success: true, data: { id: '64b000000000000000000074', status: 'pending' } });
});

test('item claim list is restricted to its owner and serializes names but not contact fields', async (t) => {
  const app = createApp();
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER) }) }) }));
  const unauthorized = await request(app).get(`/api/items/${ITEM}/claims`).set('Authorization', authorize(t, CLAIMANT));
  assert.equal(unauthorized.status, 403);

  t.mock.method(Claim, 'find', () => {
    let populateCalls = 0;
    const query = { populate: () => { populateCalls += 1; return query; }, sort: () => query, lean: async () => {
      assert.equal(populateCalls, 2);
      return [{
        _id: new mongoose.Types.ObjectId(), item: { _id: new mongoose.Types.ObjectId(ITEM), title: 'Found bag', type: 'found', status: 'active' },
        claimant: { _id: new mongoose.Types.ObjectId(CLAIMANT), name: 'Claimant', email: 'private@example.edu', password: 'hash' },
        itemOwner: new mongoose.Types.ObjectId(OWNER), status: 'pending', claimMessage: 'I know the inside pocket mark.', createdAt: new Date(), reviewedAt: null,
      }];
    } };
    return query;
  });
  const ownerResponse = await request(app).get(`/api/items/${ITEM}/claims`).set('Authorization', authorize(t, OWNER));
  assert.equal(ownerResponse.status, 200);
  assert.equal(ownerResponse.body.data[0].claimant.name, 'Claimant');
  assert.equal(JSON.stringify(ownerResponse.body).includes('private@example.edu'), false);
  assert.equal(JSON.stringify(ownerResponse.body).includes('hash'), false);
});

test('limits claim creation to five requests per user in fifteen minutes', async (t) => {
  const limitedUser = '64b000000000000000000077';
  const app = createApp();
  const token = authorize(t, limitedUser);
  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER), type: 'found', status: 'active' }) }) }));
  t.mock.method(Claim, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(Claim, 'create', async () => ({ _id: new mongoose.Types.ObjectId(), status: 'pending' }));
  const results = [];
  for (let index = 0; index < 6; index += 1) {
    results.push(await request(app).post(`/api/items/${ITEM}/claims`).set('Authorization', token).send({ claimMessage: `Distinctive detail ${index}.` }));
  }
  assert.deepEqual(results.slice(0, 5).map((response) => response.status), [201, 201, 201, 201, 201]);
  assert.equal(results[5].status, 429);
  assert.equal(results[5].body.code, 'CLAIM_RATE_LIMITED');
});
