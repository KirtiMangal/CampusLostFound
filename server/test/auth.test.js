import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import User from '../src/models/User.js';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireAuth, requireRole } from '../src/middleware/authMiddleware.js';

process.env.JWT_SECRET = 'test-only-secret';
process.env.JWT_EXPIRES_IN = '1h';

const USER_ID = '64b000000000000000000001';
const defaultUser = (overrides = {}) => ({
  _id: { toString: () => USER_ID },
  name: 'Kirti Mangal',
  email: 'student@example.edu',
  password: 'a-hash-that-is-never-returned',
  role: 'student',
  isActive: true,
  ...overrides,
});

test('registers a student, hashes the password, and returns only safe user fields', async (t) => {
  let created;
  t.mock.method(User, 'exists', async () => null);
  t.mock.method(User, 'create', async (fields) => {
    created = fields;
    return defaultUser({ ...fields, _id: { toString: () => USER_ID } });
  });

  const response = await request(createApp()).post('/api/auth/register').send({
    name: 'Kirti Mangal', email: ' STUDENT@EXAMPLE.EDU ', password: 'Password123', confirmPassword: 'Password123', role: 'admin',
  });

  assert.equal(response.status, 201);
  assert.equal(created.email, 'student@example.edu');
  assert.equal(created.role, 'student');
  assert.notEqual(created.password, 'Password123');
  assert.equal(await bcrypt.compare('Password123', created.password), true);
  assert.deepEqual(Object.keys(response.body.user).sort(), ['email', 'id', 'name', 'role']);
  assert.equal(response.body.user.role, 'student');
  assert.equal('password' in response.body, false);
  assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).userId, USER_ID);
});

test('rejects duplicate email registrations', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: USER_ID }));
  const response = await request(createApp()).post('/api/auth/register').send({
    name: 'Another Student', email: 'student@example.edu', password: 'Password123', confirmPassword: 'Password123',
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'EMAIL_IN_USE');
});

test('rejects invalid registration fields and password mismatch', async (t) => {
  t.mock.method(User, 'exists', async () => null);
  for (const body of [
    { name: '', email: 'not-an-email', password: 'short', confirmPassword: 'short' },
    { name: 'Student Name', email: 'student@example.edu', password: 'Password123', confirmPassword: 'Different123' },
  ]) {
    const response = await request(createApp()).post('/api/auth/register').send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(response.body.details.fieldErrors);
  }
});

test('logs in with valid credentials and returns no password hash', async (t) => {
  const passwordHash = await bcrypt.hash('Password123', 12);
  t.mock.method(User, 'findOne', () => ({ select: async () => defaultUser({ password: passwordHash }) }));
  const response = await request(createApp()).post('/api/auth/login').send({ email: 'STUDENT@example.edu', password: 'Password123' });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'student@example.edu');
  assert.equal('password' in response.body.user, false);
  assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).role, 'student');
});

test('uses one generic login error for wrong passwords and unknown email addresses', async (t) => {
  const passwordHash = await bcrypt.hash('Password123', 12);
  let foundUser = defaultUser({ password: passwordHash });
  t.mock.method(User, 'findOne', () => ({ select: async () => foundUser }));
  const wrongPassword = await request(createApp()).post('/api/auth/login').send({ email: 'student@example.edu', password: 'WrongPassword1' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.message, 'Invalid email or password.');

  foundUser = null;
  const unknownEmail = await request(createApp()).post('/api/auth/login').send({ email: 'unknown@example.edu', password: 'Password123' });
  assert.equal(unknownEmail.status, 401);
  assert.equal(unknownEmail.body.message, wrongPassword.body.message);
});

test('rejects a login for an inactive account without revealing account existence', async (t) => {
  const passwordHash = await bcrypt.hash('Password123', 12);
  t.mock.method(User, 'findOne', () => ({ select: async () => defaultUser({ password: passwordHash, isActive: false }) }));
  const response = await request(createApp()).post('/api/auth/login').send({ email: 'student@example.edu', password: 'Password123' });
  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Invalid email or password.');
});

test('rejects missing, malformed, and expired authorization tokens', async () => {
  const app = createApp();
  const missing = await request(app).get('/api/auth/me');
  const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
  const expiredToken = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET, { expiresIn: -1 });
  const expired = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);
  assert.equal(missing.status, 401);
  assert.equal(missing.body.code, 'AUTH_REQUIRED');
  assert.equal(malformed.status, 401);
  assert.equal(malformed.body.code, 'INVALID_TOKEN');
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'INVALID_TOKEN');
});

test('restores the current user from the database and ignores role claims in the token', async (t) => {
  t.mock.method(User, 'findById', () => ({ select: async () => defaultUser() }));
  const token = jwt.sign({ userId: USER_ID, role: 'admin' }, process.env.JWT_SECRET);
  const response = await request(createApp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.user, { id: USER_ID, name: 'Kirti Mangal', email: 'student@example.edu', role: 'student' });
  assert.equal('password' in response.body.user, false);
});

test('rejects inactive users on protected routes', async (t) => {
  t.mock.method(User, 'findById', () => ({ select: async () => defaultUser({ isActive: false }) }));
  const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET);
  const response = await request(createApp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'ACCOUNT_INACTIVE');
});

test('returns a generic server error when the user database lookup fails', async (t) => {
  t.mock.method(User, 'findById', () => ({ select: async () => { throw new Error('private database detail'); } }));
  const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET);
  const response = await request(createApp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'An unexpected server error occurred.');
  assert.equal(JSON.stringify(response.body).includes('private database detail'), false);
});

test('requires the database user role for admin authorization', async (t) => {
  const app = express();
  app.get('/admin-check', requireAuth, requireRole('admin'), (_req, res) => res.json({ status: 'ok' }));
  app.use(errorHandler);
  let foundUser = defaultUser();
  t.mock.method(User, 'findById', () => ({ select: async () => foundUser }));
  const studentToken = jwt.sign({ userId: USER_ID, role: 'admin' }, process.env.JWT_SECRET);
  const forbidden = await request(app).get('/admin-check').set('Authorization', `Bearer ${studentToken}`);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.code, 'FORBIDDEN');

  foundUser = defaultUser({ role: 'admin' });
  const adminToken = jwt.sign({ userId: USER_ID, role: 'student' }, process.env.JWT_SECRET);
  const allowed = await request(app).get('/admin-check').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(allowed.status, 200);
});
