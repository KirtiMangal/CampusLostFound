import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportDialog from './ReportDialog.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { reportApi } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderDialog = (onClose = vi.fn()) => { render(<ToastProvider><ReportDialog targetType="item" targetId="item-1" onClose={onClose} /></ToastProvider>); return onClose; };

it('validates a reason, submits a report, and closes with a success message', async () => {
  const onClose = renderDialog();
  vi.spyOn(reportApi, 'create').mockResolvedValue({ success: true });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
  expect((await screen.findByRole('alert')).textContent).toContain('Choose a reason');
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'fake_information' } });
  fireEvent.change(screen.getByLabelText(/Additional details/), { target: { value: 'This description does not match the photos.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(reportApi.create).toHaveBeenCalledWith({ targetType: 'item', targetId: 'item-1', reason: 'fake_information', description: 'This description does not match the photos.' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect((await screen.findByRole('status')).textContent).toMatch(/report was submitted/i);
});

it('prevents duplicate submissions while the request is pending and shows API errors', async () => {
  let finish;
  vi.spyOn(reportApi, 'create').mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const onClose = renderDialog();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'spam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submitting…' }));
  expect(reportApi.create).toHaveBeenCalledOnce();
  finish({ success: true });
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

  vi.restoreAllMocks(); cleanup();
  vi.spyOn(reportApi, 'create').mockRejectedValue({ response: { data: { message: 'Duplicate report.' } } });
  renderDialog();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'spam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Duplicate report.');
  expect(screen.getByRole('dialog')).toBeTruthy();
});
