import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { describeItem, setGeminiClientFactoryForTests } from '../src/services/geminiService.js';

process.env.JWT_SECRET = 'test-only-secret';
process.env.GEMINI_API_KEY = 'test-gemini-key';
const STUDENT_ID = '64b000000000000000000021';
const ADMIN_ID = '64b000000000000000000022';
const validInput = { type: 'lost', category: 'Other', title: 'black bottle', roughDescription: 'black water bottle with a small sticker', location: 'library', date: '2026-10-02' };
const suggestion = {
  suggestedTitle: 'Black water bottle with sticker',
  suggestedDescription: 'A black water bottle with a small sticker was reported near the library.',
  keywords: ['black', 'water bottle', 'sticker', 'library'],
  suggestedCategory: 'Other',
  clarifyingQuestions: ['What brand is the bottle?'],
};

function authenticated(t, userId = STUDENT_ID, role = 'student') {
  const user = { _id: new mongoose.Types.ObjectId(userId), id: userId, name: 'Test User', role, isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  return `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET)}`;
}

function mockGemini(t, response = suggestion) {
  const calls = [];
  const restoreFactory = setGeminiClientFactoryForTests((apiKey) => {
    assert.equal(apiKey, process.env.GEMINI_API_KEY);
    return { models: { generateContent: async (params) => { calls.push(params); return { text: JSON.stringify(response) }; } } };
  });
  t.after(restoreFactory);
  return calls;
}

test('rejects unauthenticated AI requests and allows authenticated students and admins', async (t) => {
  mockGemini(t);
  const unauthenticated = await request(createApp()).post('/api/ai/describe').send(validInput);
  assert.equal(unauthenticated.status, 401);

  let currentUser = { _id: new mongoose.Types.ObjectId(STUDENT_ID), id: STUDENT_ID, name: 'Test User', role: 'student', isActive: true };
  t.mock.method(User, 'findById', () => ({ select: async () => currentUser }));
  const studentToken = jwt.sign({ userId: STUDENT_ID, role: 'student' }, process.env.JWT_SECRET);
  const student = await request(createApp()).post('/api/ai/describe').set('Authorization', `Bearer ${studentToken}`).send(validInput);
  assert.equal(student.status, 200);
  assert.deepEqual(student.body, { success: true, data: suggestion });

  currentUser = { _id: new mongoose.Types.ObjectId(ADMIN_ID), id: ADMIN_ID, name: 'Test Admin', role: 'admin', isActive: true };
  const adminToken = jwt.sign({ userId: ADMIN_ID, role: 'admin' }, process.env.JWT_SECRET);
  const admin = await request(createApp()).post('/api/ai/describe').set('Authorization', `Bearer ${adminToken}`).send(validInput);
  assert.equal(admin.status, 200);
  assert.deepEqual(admin.body.data, suggestion);
});

test('validates required description, length, type, category, date, and strict input fields', async (t) => {
  const auth = authenticated(t);
  for (const invalid of [
    { ...validInput, roughDescription: '' },
    { ...validInput, roughDescription: 'a'.repeat(2001) },
    { ...validInput, type: 'unknown' },
    { ...validInput, category: 'Invented' },
    { ...validInput, date: 'not-a-date' },
    { ...validInput, password: 'must not be accepted' },
  ]) {
    const response = await request(createApp()).post('/api/ai/describe').set('Authorization', auth).send(invalid);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'AI_INPUT_INVALID');
  }
  const malformedJson = await request(createApp()).post('/api/ai/describe').set('Authorization', auth).set('Content-Type', 'application/json').send('{broken');
  assert.equal(malformedJson.status, 400);
  assert.equal(malformedJson.body.code, 'INVALID_JSON');
});

test('uses a controlled JSON schema, supported categories, and only relevant item fields', async (t) => {
  const calls = mockGemini(t);
  const response = await describeItem(validInput);
  assert.deepEqual(response, suggestion);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, process.env.GEMINI_MODEL || 'gemini-3.8-flash');
  assert.equal(calls[0].config.responseMimeType, 'application/json');
  assert.deepEqual(calls[0].config.responseJsonSchema.properties.suggestedCategory.enum.includes('Other'), true);
  assert.deepEqual(JSON.parse(calls[0].contents), validInput);
  assert.equal(JSON.stringify(calls[0]).includes('test-gemini-key'), false);
  assert.match(calls[0].config.systemInstruction, /untrusted data/);
  assert.match(calls[0].config.systemInstruction, /Never invent/);
});

test('rejects malformed model JSON and output that is missing fields or exceeds list limits', async () => {
  const outputs = [
    '{not json',
    JSON.stringify({ ...suggestion, suggestedTitle: undefined }),
    JSON.stringify({ ...suggestion, keywords: Array.from({ length: 11 }, (_, index) => `word-${index}`) }),
    JSON.stringify({ ...suggestion, clarifyingQuestions: Array.from({ length: 6 }, (_, index) => `Question ${index}?`) }),
    JSON.stringify({ ...suggestion, suggestedCategory: 'Made up' }),
  ];
  for (const output of outputs) {
    const restoreFactory = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => ({ text: output }) } }));
    try { await assert.rejects(() => describeItem(validInput), { statusCode: 502, code: 'AI_INVALID_RESPONSE' }); }
    finally { restoreFactory(); }
  }
});

test('returns a friendly controlled error when Gemini fails', async (t) => {
  const restoreFactory = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => { throw new Error('private upstream detail'); } } }));
  t.after(restoreFactory);
  await assert.rejects(() => describeItem(validInput), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, 'AI_UNAVAILABLE');
    assert.doesNotMatch(error.message, /private upstream detail/);
    return true;
  });
});

test('returns a controlled setup error when the server key is missing', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey; });
  await assert.rejects(() => describeItem(validInput), { statusCode: 503, code: 'AI_NOT_CONFIGURED' });
});

test('limits an authenticated user to ten AI calls per fifteen minutes', async (t) => {
  const uniqueId = new mongoose.Types.ObjectId().toString();
  const auth = authenticated(t, uniqueId);
  mockGemini(t);
  const app = createApp();
  let last;
  for (let index = 0; index < 11; index++) {
    last = await request(app).post('/api/ai/describe').set('Authorization', auth).send(validInput);
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.code, 'AI_RATE_LIMITED');
});
