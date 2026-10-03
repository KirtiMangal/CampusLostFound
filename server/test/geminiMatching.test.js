import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setGeminiClientFactoryForTests } from '../src/services/geminiService.js';
import { evaluateMatch } from '../src/services/geminiMatchingService.js';

process.env.GEMINI_API_KEY = 'test-gemini-key';
const source = { type: 'lost', title: 'Blue bottle', description: 'Steel bottle', category: 'Accessories', location: 'Library', date: '2026-10-01', owner: 'private-user', password: 'never-send' };
const candidate = { type: 'found', title: 'Blue bottle', description: 'Steel bottle', category: 'Accessories', location: 'Library', date: new Date('2026-10-01T00:00:00Z'), contact: 'private@example.edu' };
const response = { confidence: 87, decision: 'possible_match', reasoning: ['The reports share a distinctive color and description.'], matchingSignals: ['Blue bottle'], contradictingSignals: [], missingInformation: ['Brand is unknown.'] };

function mock(responseText) {
  const calls = [];
  const restore = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async (params) => { calls.push(params); return { text: responseText }; } } }));
  return { calls, restore };
}

test('uses only report fields and validates structured matching assessments', async (t) => {
  const mocked = mock(JSON.stringify(response));
  t.after(mocked.restore);
  assert.deepEqual(await evaluateMatch(source, candidate), response);
  const payload = JSON.parse(mocked.calls[0].contents);
  assert.deepEqual(Object.keys(payload.lostReport), ['type', 'title', 'description', 'category', 'location', 'date']);
  assert.equal(JSON.stringify(payload).includes('private-user'), false);
  assert.equal(JSON.stringify(payload).includes('private@example.edu'), false);
  assert.match(mocked.calls[0].config.systemInstruction, /untrusted report data/);
  assert.equal(mocked.calls[0].config.responseMimeType, 'application/json');
});

test('rejects malformed and schema-invalid Gemini assessments', async () => {
  for (const output of ['not json', JSON.stringify({ ...response, confidence: 101 }), JSON.stringify({ ...response, decision: 'certain_match' }), JSON.stringify({ ...response, missingInformation: undefined })]) {
    const mocked = mock(output);
    try { await assert.rejects(() => evaluateMatch(source, candidate), { code: 'AI_INVALID_RESPONSE', statusCode: 502 }); }
    finally { mocked.restore(); }
  }
});

test('converts provider failures into the shared controlled AI error', async (t) => {
  const restore = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => { throw new Error('private provider detail'); } } }));
  t.after(restore);
  await assert.rejects(() => evaluateMatch(source, candidate), { code: 'AI_UNAVAILABLE', statusCode: 503 });
});

test('converts Gemini timeouts to the same controlled fallback error', async (t) => {
  const restore = setGeminiClientFactoryForTests(() => ({ models: { generateContent: async () => { const error = new Error('timed out'); error.name = 'AbortError'; throw error; } } }));
  t.after(restore);
  await assert.rejects(() => evaluateMatch(source, candidate), { code: 'AI_UNAVAILABLE', statusCode: 503 });
});
