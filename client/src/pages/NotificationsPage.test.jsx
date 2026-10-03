import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage from './NotificationsPage.jsx';
import { notificationApi } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const page = { data: [{ id: 'n1', type: 'CLAIM_RECEIVED', title: 'New claim', message: 'A student submitted a claim.', isRead: false, relatedItem: 'item-1', createdAt: '2026-10-02T10:00:00Z' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };

it('lists notifications and supports mark-one and mark-all actions', async () => {
  vi.spyOn(notificationApi, 'list').mockResolvedValue(page);
  vi.spyOn(notificationApi, 'markRead').mockResolvedValue({});
  vi.spyOn(notificationApi, 'markAllRead').mockResolvedValue({});
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'New claim' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(notificationApi.markRead).toHaveBeenCalledWith('n1');
  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  expect(notificationApi.markAllRead).toHaveBeenCalledOnce();
});

it('renders empty and recoverable error states', async () => {
  vi.spyOn(notificationApi, 'list').mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const view = render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
  expect(await screen.findByText('No notifications yet')).toBeTruthy();
  view.unmount();
  vi.restoreAllMocks();
  vi.spyOn(notificationApi, 'list').mockRejectedValue({ response: { data: { message: 'Notifications are offline.' } } });
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toBeTruthy();
});
