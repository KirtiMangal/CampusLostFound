import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Item from '../src/models/Item.js';
import Claim from '../src/models/Claim.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = 'analytics-test-secret';
const STUDENT = '64b000000000000000000091';
const ADMIN = '64b000000000000000000092';

function authorize(t, userId, role) {
  const user = { _id: new mongoose.Types.ObjectId(userId), id: userId, name: 'Analytics User', role, isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}`;
}

test('admin analytics APIs require the database admin role and return aggregates', async (t) => {
  let aggregateCalls = 0;
  t.mock.method(Item, 'aggregate', async () => { aggregateCalls += 1; return [{ _id: { type: 'lost', status: 'resolved' }, count: 2 }]; });
  t.mock.method(Claim, 'aggregate', async () => [{ _id: 'pending', count: 1 }]);
  const app = createApp();
  const denied = await request(app).get('/api/admin/analytics/overview').set('Authorization', authorize(t, STUDENT, 'student'));
  assert.equal(denied.status, 403);
  assert.equal(aggregateCalls, 0);
  const allowed = await request(app).get('/api/admin/analytics/overview').set('Authorization', authorize(t, ADMIN, 'admin'));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.recoveryRate, 100);
  assert.equal(allowed.body.data.pendingClaims, 1);
  assert.equal(JSON.stringify(allowed.body).includes('email'), false);
});

test('every analytics endpoint rejects unauthenticated requests', async () => {
  const app = createApp();
  for (const path of ['/overview', '/trends', '/categories', '/locations']) {
    const response = await request(app).get(`/api/admin/analytics${path}`);
    assert.equal(response.status, 401);
  }
});
