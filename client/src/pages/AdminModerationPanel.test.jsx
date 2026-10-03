import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminModerationPanel from './AdminModerationPanel.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { authApi, authToken, moderationApi } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function renderPanel() {
  authToken.set('admin-token');
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { id: 'admin-1', name: 'Moderator', role: 'admin', email: 'admin@example.edu' } });
  return render(<AuthProvider><ToastProvider><MemoryRouter><AdminModerationPanel /></MemoryRouter></ToastProvider></AuthProvider>);
}
const page = { success: true, data: [{ id: 'report-1', targetType: 'item', targetId: 'item-1', reason: 'fake_information', description: 'Description is misleading.', status: 'pending', priority: 'high', autoFlagged: true, moderationScore: 70, reporter: { name: 'Reporter' }, createdAt: '2026-10-02T10:00:00Z' }], pagination: { page: 1, totalPages: 1, total: 1 } };
const reportDetails = { data: { ...page.data[0], target: { id: 'item-1', title: 'Lost wallet', description: 'Blue leather wallet.', category: 'Accessories', type: 'lost', location: 'Library', status: 'active', isHidden: false, owner: { id: 'owner-1', name: 'Owner' } } } };

it('lists reports, filters automatic flags, reviews a case, and handles API errors', async () => {
  vi.spyOn(moderationApi, 'reports').mockResolvedValue(page);
  vi.spyOn(moderationApi, 'users').mockResolvedValue({ activeAdminCount: 2, data: [] });
  vi.spyOn(moderationApi, 'report').mockResolvedValue(reportDetails);
  vi.spyOn(moderationApi, 'reviewReport').mockResolvedValue({ success: true });
  renderPanel();
  expect(await screen.findByText(/fake information · item/i)).toBeTruthy();
  expect(screen.getAllByText('Auto-flagged').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Auto-flagged' }));
  await waitFor(() => expect(moderationApi.reports).toHaveBeenLastCalledWith({ autoFlagged: 'true', page: 1, limit: 20, sort: 'newest' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(await screen.findByText('Reported item')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'under_review' } });
  fireEvent.change(screen.getByLabelText('Resolution note'), { target: { value: 'Checked the evidence.' } });
  fireEvent.change(screen.getByLabelText('Reported item visibility'), { target: { value: 'hide' } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  await waitFor(() => expect(moderationApi.reviewReport).toHaveBeenCalledWith('report-1', { status: 'under_review', priority: 'high', resolutionNote: 'Checked the evidence.', itemAction: 'hide' }));
  expect(window.confirm).toHaveBeenCalledWith('Hide this item from campus listings?');

  vi.restoreAllMocks(); cleanup();
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { id: 'admin-1', name: 'Moderator', role: 'admin' } });
  vi.spyOn(moderationApi, 'reports').mockRejectedValue({ response: { data: { message: 'Queue unavailable.' } } });
  vi.spyOn(moderationApi, 'users').mockResolvedValue({ activeAdminCount: 2, data: [] });
  renderPanel();
  expect((await screen.findByRole('alert')).textContent).toContain('Queue unavailable.');
});

it('shows the empty reports state and prevents self or last-admin suspension', async () => {
  vi.spyOn(moderationApi, 'reports').mockResolvedValue({ data: [], pagination: { page: 1, totalPages: 0, total: 0 } });
  vi.spyOn(moderationApi, 'users').mockResolvedValue({ activeAdminCount: 1, data: [
    { id: 'admin-1', name: 'Moderator', email: 'admin@example.edu', role: 'admin', isActive: true, createdAt: '2026-01-01' },
    { id: 'person-1', name: 'Person', email: 'person@example.edu', role: 'student', isActive: true, createdAt: '2026-02-01' },
  ], pagination: { page: 1, totalPages: 1, total: 2 } });
  renderPanel();
  expect(await screen.findByText('No reports match these filters.')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Users' }));
  expect(await screen.findByText('person@example.edu')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Suspend', exact: true })[1].disabled).toBe(false);
  expect(screen.getByText('Last active admin')).toBeTruthy();
  const selfCard = screen.getByText('admin@example.edu').closest('article');
  expect(selfCard.querySelector('button').disabled).toBe(true);
  fireEvent.click(screen.getAllByRole('button', { name: 'Suspend' })[1]);
  expect(await screen.findByRole('dialog', { name: 'Suspend Person?' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirm suspension' }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Repeated fraudulent listings' } });
  vi.spyOn(moderationApi, 'suspendUser').mockResolvedValue({ success: true });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm suspension' }));
  await waitFor(() => expect(moderationApi.suspendUser).toHaveBeenCalledWith('person-1', 'Repeated fraudulent listings'));
});

it('shows suspended accounts and lets an admin restore an account', async () => {
  vi.spyOn(moderationApi, 'reports').mockResolvedValue({ data: [], pagination: { page: 1, totalPages: 0, total: 0 } });
  vi.spyOn(moderationApi, 'users').mockImplementation(async (params) => ({ activeAdminCount: 2, data: params.active === 'false' ? [
    { id: 'person-2', name: 'Suspended Person', email: 'suspended@example.edu', role: 'student', isActive: false, suspensionReason: 'Repeated abuse', suspendedAt: '2026-10-01', createdAt: '2026-01-01' },
  ] : [], pagination: { page: 1, totalPages: 1, total: 1 } }));
  vi.spyOn(moderationApi, 'unsuspendUser').mockResolvedValue({ success: true });
  renderPanel();
  fireEvent.click(screen.getByRole('tab', { name: 'Users' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Suspended' }));
  expect(await screen.findByText('Suspended Person')).toBeTruthy();
  expect(screen.getByText(/Repeated abuse/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Unsuspend' }));
  await waitFor(() => expect(moderationApi.unsuspendUser).toHaveBeenCalledWith('person-2'));
});
