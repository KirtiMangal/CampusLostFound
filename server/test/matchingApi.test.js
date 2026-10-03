import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Item from '../src/models/Item.js';
import Match from '../src/models/Match.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'test-only-secret';
const OWNER = '64b000000000000000000031';
const OTHER = '64b000000000000000000032';
const ITEM = '64b000000000000000000033';
const RELATED = '64b000000000000000000034';
const MATCH_ID = '64b000000000000000000035';

function auth(t, userId = OWNER, role = 'student') {
  const user = { _id: new mongoose.Types.ObjectId(userId), id: userId, name: 'Tester', role, isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET)}`;
}

function mockMatchQueries(t) {
  let matchQueries = 0;
  t.mock.method(Item, 'findById', (_id) => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER) }) }) }));
  t.mock.method(Match, 'find', (filter) => {
    matchQueries += 1;
    assert.equal(filter.finalScore.$gte, 40);
    let query = { populate: () => query, sort: () => query, lean: async () => [{
      _id: new mongoose.Types.ObjectId(MATCH_ID),
      sourceItem: { _id: new mongoose.Types.ObjectId(ITEM), title: 'Lost report' },
      candidateItem: { _id: new mongoose.Types.ObjectId(RELATED), title: 'Found blue bottle', description: 'Steel bottle', type: 'found', category: 'Accessories', location: 'Library', date: new Date('2026-10-01T00:00:00Z'), images: [{ url: 'https://images.example/bottle.jpg', publicId: 'hidden-internal-id' }], owner: 'private-owner', email: 'private@example.edu' },
      finalScore: 84, classification: 'strong_candidate', matchingSignals: ['Same category'],
    }] };
    return query;
  });
  return () => matchQueries;
}

test('returns sanitized ranked matches to the report owner and administrator', async (t) => {
  const queryCount = mockMatchQueries(t);
  const app = createApp();
  const ownerResponse = await request(app).get(`/api/items/${ITEM}/matches`).set('Authorization', auth(t));
  assert.equal(ownerResponse.status, 200);
  assert.equal(ownerResponse.body.data[0].finalScore, 84);
  assert.equal(ownerResponse.body.data[0].item.id, RELATED);
  assert.deepEqual(ownerResponse.body.data[0].item.images, [{ url: 'https://images.example/bottle.jpg' }]);
  assert.equal(JSON.stringify(ownerResponse.body).includes('private@example.edu'), false);
  assert.equal(JSON.stringify(ownerResponse.body).includes('private-owner'), false);
  assert.equal(JSON.stringify(ownerResponse.body).includes('hidden-internal-id'), false);

  const adminResponse = await request(app).get(`/api/items/${ITEM}/matches`).set('Authorization', auth(t, OTHER, 'admin'));
  assert.equal(adminResponse.status, 200);
  assert.equal(queryCount(), 2);
});

test('rejects unauthenticated and non-owner match reads, and validates missing or malformed IDs', async (t) => {
  const app = createApp();
  const unauthenticated = await request(app).get(`/api/items/${ITEM}/matches`);
  assert.equal(unauthenticated.status, 401);

  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(ITEM), owner: new mongoose.Types.ObjectId(OWNER) }) }) }));
  const forbidden = await request(app).get(`/api/items/${ITEM}/matches`).set('Authorization', auth(t, OTHER));
  assert.equal(forbidden.status, 403);

  const invalid = await request(app).get('/api/items/not-an-id/matches').set('Authorization', auth(t));
  assert.equal(invalid.status, 400);

  t.mock.method(Item, 'findById', () => ({ select: () => ({ lean: async () => null }) }));
  const missing = await request(app).get(`/api/items/${ITEM}/matches`).set('Authorization', auth(t));
  assert.equal(missing.status, 404);
});
