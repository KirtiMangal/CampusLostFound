import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiApi, api, authToken, itemApi } from './api.js';

afterEach(() => { vi.restoreAllMocks(); authToken.clear(); });

describe('itemApi image submission', () => {
  it('sends selected files with item fields as multipart form data', async () => {
    const file = new File(['image'], 'item.png', { type: 'image/png' });
    vi.spyOn(api, 'post').mockResolvedValue({ data: { item: { id: 'item-1' } } });
    const result = await itemApi.create({ title: 'Water bottle', date: '2026-10-02', type: 'lost' }, [file]);
    const [url, payload, config] = api.post.mock.calls[0];
    expect(url).toBe('/items');
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get('title')).toBe('Water bottle');
    expect(payload.get('images')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(result.item.id).toBe('item-1');
  });

  it('keeps text-only creation as a JSON request', async () => {
    const values = { title: 'Keys', type: 'found' };
    vi.spyOn(api, 'post').mockResolvedValue({ data: { item: { id: 'item-2' } } });
    await itemApi.create(values);
    expect(api.post.mock.calls[0][1]).toBe(values);
    expect(api.post.mock.calls[0][2]).toBeUndefined();
  });
});

it('sends description assistance data to the authenticated backend API', async () => {
  const request = { type: 'found', roughDescription: 'blue notebook near lab' };
  vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true, data: { suggestedTitle: 'Blue notebook' } } });
  const response = await aiApi.describe(request);
  expect(api.post).toHaveBeenCalledWith('/ai/describe', request);
  expect(response.success).toBe(true);
});

describe('API error feedback', () => {
  const rejectResponse = api.interceptors.response.handlers[0].rejected;

  it('clears expired sessions and dispatches the authentication event on 401', async () => {
    authToken.set('expired-token');
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const error = { response: { status: 401 } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    expect(authToken.get()).toBeNull();
    expect(dispatch.mock.calls[0][0].type).toBe('campus-auth-expired');
  });

  it.each([
    [403, undefined, 'You do not have permission to do that.'],
    [429, 'Please try later.', 'Please try later.'],
  ])('dispatches clear feedback for HTTP %s responses', async (status, message, expected) => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const error = { response: { status, data: { message } } };
    await expect(rejectResponse(error)).rejects.toBe(error);
    const feedback = dispatch.mock.calls[0][0];
    expect(feedback.type).toBe('campus-api-feedback');
    expect(feedback.detail).toBe(expected);
  });
});
