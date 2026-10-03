import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from './AdminDashboardPage.jsx';
import { analyticsApi, moderationApi } from '../services/api.js';

vi.mock('recharts', () => Object.fromEntries(['Bar', 'BarChart', 'CartesianGrid', 'Cell', 'Legend', 'Line', 'LineChart', 'Pie', 'PieChart', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map((name) => [name, ({ children }) => <div data-chart={name}>{children}</div>])));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const renderAdmin = () => render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

const overview = { totalItems: 12, lostItems: 7, foundItems: 5, resolvedItems: 3, pendingClaims: 2, recoveryRate: 28.6 };
const trends = { weeks: [{ week: '2026-09-28', lost: 1, found: 2, resolved: 1 }], comparison: { current4WeekTotal: 8, previous4WeekTotal: 6, percentageChange: 33.3 } };

it('loads aggregate metrics and chart sections', async () => {
  vi.spyOn(analyticsApi, 'overview').mockResolvedValue({ data: overview });
  vi.spyOn(analyticsApi, 'trends').mockResolvedValue({ data: trends });
  vi.spyOn(analyticsApi, 'categories').mockResolvedValue({ data: [{ category: 'Bags', count: 4 }] });
  vi.spyOn(analyticsApi, 'locations').mockResolvedValue({ data: [{ location: 'Library', count: 3 }] });
  renderAdmin();
  expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeTruthy();
  expect(screen.getByText('28.6%')).toBeTruthy();
  expect(screen.getByText('8-week report and resolution trend')).toBeTruthy();
  expect(screen.getByText('Category distribution')).toBeTruthy();
  expect(screen.getByText('Top lost-item locations')).toBeTruthy();
});

it('shows loading and error states', async () => {
  let finish;
  vi.spyOn(analyticsApi, 'overview').mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  vi.spyOn(analyticsApi, 'trends').mockResolvedValue({ data: trends });
  vi.spyOn(analyticsApi, 'categories').mockResolvedValue({ data: [] });
  vi.spyOn(analyticsApi, 'locations').mockResolvedValue({ data: [] });
  const view = renderAdmin();
  expect(screen.getByRole('status').textContent).toMatch(/Loading campus analytics/);
  finish({ data: overview });
  await screen.findByRole('heading', { name: 'Admin Dashboard' });
  view.unmount();
  vi.restoreAllMocks();
  vi.spyOn(analyticsApi, 'overview').mockRejectedValue({ response: { data: { message: 'Analytics unavailable.' } } });
  vi.spyOn(analyticsApi, 'trends').mockResolvedValue({ data: trends });
  vi.spyOn(analyticsApi, 'categories').mockResolvedValue({ data: [] });
  vi.spyOn(analyticsApi, 'locations').mockResolvedValue({ data: [] });
  renderAdmin();
  expect(await screen.findByRole('alert')).toBeTruthy();
});

it('keeps the moderation tab available when analytics requests fail', async () => {
  vi.spyOn(analyticsApi, 'overview').mockRejectedValue(new Error('offline'));
  vi.spyOn(analyticsApi, 'trends').mockResolvedValue({ data: trends });
  vi.spyOn(analyticsApi, 'categories').mockResolvedValue({ data: [] });
  vi.spyOn(analyticsApi, 'locations').mockResolvedValue({ data: [] });
  vi.spyOn(moderationApi, 'reports').mockResolvedValue({ data: [], pagination: { page: 1, totalPages: 0, total: 0 } });
  vi.spyOn(moderationApi, 'users').mockResolvedValue({ activeAdminCount: 1, data: [] });
  renderAdmin();
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Moderation' }));
  expect(await screen.findByRole('heading', { name: 'Content reports' })).toBeTruthy();
  expect(await screen.findByText('No reports match these filters.')).toBeTruthy();
});
