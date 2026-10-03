import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import { notificationApi } from '../services/api.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const notification = { id: 'note-1', type: 'MATCH_FOUND', title: 'Possible match', message: 'A report may match yours.', isRead: false, relatedItem: 'item-2', createdAt: '2026-10-02T10:00:00Z' };

it('shows recent notifications, marks an unread entry read, and opens its item', async () => {
  vi.spyOn(notificationApi, 'list').mockResolvedValue({ data: [notification] });
  vi.spyOn(notificationApi, 'unreadCount').mockResolvedValue({ count: 1 });
  vi.spyOn(notificationApi, 'markRead').mockResolvedValue({ success: true });
  render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<NotificationBell />} /><Route path="/items/:id" element={<div>Item destination</div>} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
  expect(await screen.findByRole('dialog', { name: 'Recent notifications' })).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: /Possible match/ }));
  expect(notificationApi.markRead).toHaveBeenCalledWith('note-1');
  expect(await screen.findByText('Item destination')).toBeTruthy();
});

it('displays an empty state and a recoverable load error', async () => {
  vi.spyOn(notificationApi, 'list').mockResolvedValue({ data: [] });
  vi.spyOn(notificationApi, 'unreadCount').mockResolvedValue({ count: 0 });
  render(<MemoryRouter><NotificationBell /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  expect(await screen.findByText('You’re all caught up.')).toBeTruthy();
  vi.restoreAllMocks();
  vi.spyOn(notificationApi, 'list').mockRejectedValue(new Error('offline'));
  vi.spyOn(notificationApi, 'unreadCount').mockRejectedValue(new Error('offline'));
  cleanup();
  render(<MemoryRouter><NotificationBell /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
});

it('opens the admin moderation section for a moderation notification', async () => {
  vi.spyOn(notificationApi, 'list').mockResolvedValue({ data: [{ ...notification, id: 'mod-1', type: 'MODERATION_REPORT', relatedItem: null, relatedReport: 'report-1', isRead: true, title: 'Report ready for review' }] });
  vi.spyOn(notificationApi, 'unreadCount').mockResolvedValue({ count: 0 });
  render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<NotificationBell />} /><Route path="/admin" element={<p>Admin moderation destination</p>} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  fireEvent.click(await screen.findByRole('button', { name: /Report ready for review/ }));
  expect(await screen.findByText('Admin moderation destination')).toBeTruthy();
});
