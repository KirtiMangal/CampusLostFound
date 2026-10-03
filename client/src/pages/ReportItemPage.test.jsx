import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportItemPage from './ReportItemPage.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { itemApi } from '../services/api.js';
import { aiApi } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('submits the report and selected image, shows success, then opens the new item', async () => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:report-preview') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  const file = new File(['image'], 'bag.png', { type: 'image/png' });
  vi.spyOn(itemApi, 'create').mockResolvedValue({ item: { id: 'created-item' } });
  render(<MemoryRouter initialEntries={['/report/lost']}><ToastProvider><Routes>
    <Route path="/report/lost" element={<ReportItemPage type="lost" />} />
    <Route path="/items/:id" element={<p>Created report destination</p>} />
  </Routes></ToastProvider></MemoryRouter>);

  fireEvent.change(screen.getByLabelText('Item title'), { target: { value: 'Canvas bag' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Green canvas bag with a patch.' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Bags' } });
  fireEvent.change(screen.getByLabelText('Campus location'), { target: { value: 'Library' } });
  fireEvent.change(screen.getByLabelText('Date lost'), { target: { value: '2026-10-02' } });
  const imageInput = screen.getByLabelText('Choose item photos');
  Object.defineProperty(imageInput, 'files', { configurable: true, value: [file] });
  fireEvent.change(imageInput);
  fireEvent.click(screen.getByRole('button', { name: 'Post report' }));

  expect(await screen.findByText('Your lost item report is posted.')).toBeTruthy();
  expect(itemApi.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Canvas bag', type: 'lost', date: '2026-10-02' }), [file]);
  expect(await screen.findByText('Created report destination')).toBeTruthy();
});

it('requests a suggestion, shows loading and review content, and applies it only after the user clicks', async () => {
  let resolveSuggestion;
  vi.spyOn(aiApi, 'describe').mockReturnValue(new Promise((resolve) => { resolveSuggestion = resolve; }));
  render(<MemoryRouter initialEntries={['/report/lost']}><ToastProvider><Routes>
    <Route path="/report/lost" element={<ReportItemPage type="lost" />} />
  </Routes></ToastProvider></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'black bottle with a sticker' } });
  fireEvent.click(screen.getByRole('button', { name: 'Help me describe it' }));
  expect(await screen.findByText('Generating a description suggestion…')).toBeTruthy();
  expect(aiApi.describe).toHaveBeenCalledWith({ type: 'lost', roughDescription: 'black bottle with a sticker' });

  resolveSuggestion({ data: {
    suggestedTitle: 'Black bottle with sticker',
    suggestedDescription: 'A black bottle with a sticker was reported.',
    suggestedCategory: 'Other',
    keywords: ['black', 'bottle', 'sticker'],
    clarifyingQuestions: ['What brand is the bottle?'],
  } });
  expect(await screen.findByText('Black bottle with sticker')).toBeTruthy();
  expect(screen.getByText('What brand is the bottle?')).toBeTruthy();
  expect(screen.getByText('sticker', { selector: '.ai-keyword' })).toBeTruthy();
  expect(screen.getByLabelText('Item title').value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Use suggestions' }));
  expect(screen.getByLabelText('Item title').value).toBe('Black bottle with sticker');
  expect(screen.getByLabelText('Description').value).toBe('A black bottle with a sticker was reported.');
  expect(screen.getByLabelText('Category').value).toBe('Other');
});

it('keeps reporting usable when AI fails and locally rejects an empty rough description', async () => {
  const describe = vi.spyOn(aiApi, 'describe').mockRejectedValue({ response: { data: { message: 'AI assistance is temporarily unavailable. You can continue entering the description manually.' } } });
  render(<MemoryRouter initialEntries={['/report/found']}><ToastProvider><Routes>
    <Route path="/report/found" element={<ReportItemPage type="found" />} />
  </Routes></ToastProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Help me describe it' }));
  expect(await screen.findByText('Add a rough description first. You can keep it short.')).toBeTruthy();
  expect(describe).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'silver keyring near the gym' } });
  fireEvent.click(screen.getByRole('button', { name: 'Help me describe it' }));
  expect(await screen.findByText(/AI assistance is temporarily unavailable/)).toBeTruthy();
  expect(screen.getByLabelText('Description').value).toBe('silver keyring near the gym');
  expect(screen.getByLabelText('Item title')).toBeTruthy();
});
