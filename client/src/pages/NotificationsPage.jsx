import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../services/api.js';

function targetFor(notification) {
  if (notification.type === 'MODERATION_REPORT' || notification.relatedReport) return '/admin?tab=moderation';
  if (notification.type === 'CLAIM_APPROVED' || notification.type === 'CLAIM_REJECTED') return '/dashboard';
  if (notification.relatedItem) return `/items/${notification.relatedItem}`;
  if (notification.relatedClaim) return '/dashboard';
  return '/notifications';
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (currentPage = page) => {
    setLoading(true);
    try {
      const result = await notificationApi.list({ page: currentPage, limit: 20 });
      setNotifications(result.data || []);
      setPagination(result.pagination);
      setError('');
    } catch (err) { setError(err.response?.data?.message || 'Notifications could not be loaded.'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(page); }, [page, load]);

  async function markRead(notification) {
    if (notification.isRead) return;
    try {
      await notificationApi.markRead(notification.id);
      setNotifications((items) => items.map((entry) => entry.id === notification.id ? { ...entry, isRead: true } : entry));
    } catch (err) { setError(err.response?.data?.message || 'This notification could not be marked as read.'); }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead();
      setNotifications((items) => items.map((entry) => ({ ...entry, isRead: true })));
    } catch (err) { setError(err.response?.data?.message || 'Notifications could not be updated.'); }
  }

  return <section className="notifications-page">
    <div className="notifications-heading"><div><span className="eyebrow">YOUR UPDATES</span><h1>Notifications</h1><p>Updates about possible matches and ownership claims.</p></div><button className="button button-secondary" onClick={() => void markAllRead()} disabled={loading || !notifications.some((item) => !item.isRead)}>Mark all as read</button></div>
    {loading && <div className="matches-state" role="status">Loading notifications…</div>}
    {!loading && error && <div className="matches-state matches-error" role="alert">{error} <button onClick={() => void load(page)}>Try again</button></div>}
    {!loading && !error && !notifications.length && <div className="items-empty"><h2>No notifications yet</h2><p>Updates will appear here when there is something to share.</p></div>}
    {!loading && !error && !!notifications.length && <div className="notifications-list">{notifications.map((notification) => <article key={notification.id} className={notification.isRead ? 'notification-page-row' : 'notification-page-row notification-unread'}>
      <div className="notification-page-copy"><span className={`notification-read-dot ${notification.isRead ? 'is-read' : ''}`} aria-label={notification.isRead ? 'Read' : 'Unread'} /><div><h2>{notification.title}</h2><p>{notification.message}</p><time>{new Date(notification.createdAt).toLocaleString()}</time></div></div>
      <div className="notification-page-actions">{!notification.isRead && <button className="button button-secondary" onClick={() => void markRead(notification)}>Mark read</button>}<Link className="text-link" to={targetFor(notification)} onClick={() => void markRead(notification)}>Open</Link></div>
    </article>)}</div>}
    {!loading && !error && pagination.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </section>;
}
