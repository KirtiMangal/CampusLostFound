import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationApi } from '../services/api.js';

function targetFor(notification) {
  if (notification.type === 'MODERATION_REPORT' || notification.relatedReport) return '/admin?tab=moderation';
  if (notification.type === 'CLAIM_APPROVED' || notification.type === 'CLAIM_REJECTED') return '/dashboard';
  if (notification.relatedItem) return `/items/${notification.relatedItem}`;
  if (notification.relatedClaim) return '/dashboard';
  return '/notifications';
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([notificationApi.list({ page: 1, limit: 5 }), notificationApi.unreadCount()]);
      setNotifications(list.data || []);
      setUnread(count.count || 0);
      setError('');
    } catch { setError('Notifications are temporarily unavailable.'); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function openNotification(notification) {
    if (!notification.isRead) {
      try {
        await notificationApi.markRead(notification.id);
        setNotifications((items) => items.map((entry) => entry.id === notification.id ? { ...entry, isRead: true } : entry));
        setUnread((count) => Math.max(0, count - 1));
      } catch { setError('This notification could not be marked as read.'); }
    }
    setOpen(false);
    navigate(targetFor(notification));
  }

  return <div className="notification-bell-wrap">
    <button className="notification-bell" type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}>
      <Bell size={17} />{unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-popover" role="dialog" aria-label="Recent notifications">
      <div className="notification-popover-heading"><strong>Notifications</strong><span>{unread} unread</span></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {!error && !notifications.length && <p className="notification-empty">You’re all caught up.</p>}
      {!!notifications.length && <ul>{notifications.map((notification) => <li key={notification.id} className={notification.isRead ? 'notification-row' : 'notification-row notification-unread'}>
        <button type="button" onClick={() => void openNotification(notification)}><strong>{notification.title}</strong><span>{notification.message}</span><time>{new Date(notification.createdAt).toLocaleString()}</time></button>
      </li>)}</ul>}
      <Link to="/notifications" className="notification-view-all" onClick={() => setOpen(false)}>View all notifications</Link>
    </div>}
  </div>;
}
