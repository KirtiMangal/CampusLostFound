import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { validateProductionConfig } from '../src/config/securityConfig.js';

test('production configuration requires a database, explicit web origins, and a strong JWT secret', () => {
  assert.throws(() => validateProductionConfig({ NODE_ENV: 'production' }), /MONGO_URI, CLIENT_URL, JWT_SECRET/);
  assert.throws(() => validateProductionConfig({ NODE_ENV: 'production', MONGO_URI: 'mongodb://db', CLIENT_URL: 'https://campus.example', JWT_SECRET: 'short' }), /at least 32 bytes/);
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'production', MONGO_URI: 'mongodb://db', CLIENT_URL: 'https://campus.example', JWT_SECRET: 'a'.repeat(32) }));
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }));
});

test('production health is public and reports database readiness without exposing details', async () => {
  const previousMode = process.env.NODE_ENV;
  const previousReadyState = mongoose.connection.readyState;
  process.env.NODE_ENV = 'production';
  try {
    mongoose.connection.readyState = 0;
    const unavailable = await request(createApp()).get('/api/health');
    assert.equal(unavailable.status, 503);
    assert.deepEqual(unavailable.body, { status: 'error', message: 'Campus Lost & Found API is not ready' });

    mongoose.connection.readyState = 1;
    const ready = await request(createApp()).get('/api/health');
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.body, { status: 'ok', message: 'Campus Lost & Found API is running' });
  } finally {
    mongoose.connection.readyState = previousReadyState;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
  }
});

test('CORS allows only configured web origins and handles preflight requests', async () => {
  const previousUrl = process.env.CLIENT_URL;
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.CLIENT_URL = 'https://campus.example, https://admin.campus.example';
  try {
    const app = createApp();
    const allowed = await request(app).options('/api/health').set('Origin', 'https://campus.example').set('Access-Control-Request-Method', 'GET');
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://campus.example');
    const denied = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  } finally {
    if (previousUrl === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = previousUrl;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
  }
});

test('login attempts are throttled and unknown route errors do not echo query parameters', async () => {
  const app = createApp();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request(app).post('/api/auth/login').send({});
    assert.equal(response.status, 400);
  }
  const limited = await request(app).post('/api/auth/login').send({});
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, 'LOGIN_RATE_LIMITED');

  const notFound = await request(app).get('/api/missing?secret=do-not-echo');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body.message.includes('do-not-echo'), false);
});
