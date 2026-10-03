import { useCallback, useEffect, useState } from 'react';
import { moderationApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const statuses = ['pending', 'under_review', 'resolved', 'dismissed'];
const label = (value) => String(value || '').replaceAll('_', ' ');

export default function AdminModerationPanel() {
  const [section, setSection] = useState('reports');
  return <section className="moderation-admin-section">
    <div className="admin-section-tabs" role="tablist" aria-label="Moderation administration">
      <button role="tab" aria-selected={section === 'reports'} onClick={() => setSection('reports')}>Reports</button>
      <button role="tab" aria-selected={section === 'users'} onClick={() => setSection('users')}>Users</button>
    </div>
    {section === 'reports' ? <AdminReports /> : <AdminUsers />}
  </section>;
}

function AdminReports() {
  const [filter, setFilter] = useState({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [activeAdminCount, setActiveAdminCount] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await moderationApi.reports({ ...filter, page, limit: 20, sort: filter.priority === 'high' ? 'priority' : 'newest' });
      setResult(data); setError('');
    } catch (err) { setError(err.response?.data?.message || 'Reports could not be loaded.'); }
    finally { setLoading(false); }
  }, [filter, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { moderationApi.users({ role: 'admin', active: 'true', limit: 1 }).then((data) => setActiveAdminCount(data.activeAdminCount || 0)).catch(() => setActiveAdminCount(0)); }, []);

  function chooseFilter(next) { setFilter(next); setPage(1); }
  return <div className="moderation-list-panel">
    <div className="moderation-panel-heading"><div><span className="eyebrow">REVIEW QUEUE</span><h2>Content reports</h2><p>Automatic flags prioritize review; they do not suspend accounts.</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    <div className="moderation-filters" aria-label="Report filters">
      <button className={!Object.keys(filter).length ? 'active' : ''} onClick={() => chooseFilter({})}>All</button>
      {statuses.map((status) => <button className={filter.status === status ? 'active' : ''} key={status} onClick={() => chooseFilter({ status })}>{label(status)}</button>)}
      {['item', 'user', 'claim'].map((targetType) => <button className={filter.targetType === targetType ? 'active' : ''} key={targetType} onClick={() => chooseFilter({ targetType })}>{label(targetType)} reports</button>)}
      <button className={filter.priority === 'high' ? 'active' : ''} onClick={() => chooseFilter({ priority: 'high' })}>High priority</button>
      <button className={filter.autoFlagged ? 'active' : ''} onClick={() => chooseFilter({ autoFlagged: 'true' })}>Auto-flagged</button>
    </div>
    {loading && <p className="moderation-state" role="status">Loading reports…</p>}
    {!loading && error && <p className="moderation-state error" role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}
    {!loading && !error && !result?.data?.length && <p className="moderation-state">No reports match these filters.</p>}
    {!loading && !error && !!result?.data?.length && <div className="moderation-report-list">{result.data.map((report) => <article className="moderation-report-card" key={report.id}>
      <div><div className="moderation-badges"><span className={`moderation-status status-${report.status}`}>{label(report.status)}</span><span className={`moderation-priority priority-${report.priority}`}>{label(report.priority)} priority</span>{report.autoFlagged && <span className="moderation-flag">Auto-flagged</span>}</div>
        <h3>{label(report.reason)} · {label(report.targetType)}</h3><p>{report.description || 'No additional details provided.'}</p><small>Reported by {report.reporter?.name || 'Campus member'} · {new Date(report.createdAt).toLocaleString()}</small></div>
      <button className="button button-primary" onClick={() => setSelected(report.id)}>Review</button>
    </article>)}</div>}
    {!loading && !error && result?.pagination?.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {result.pagination.totalPages}</span><button disabled={page >= result.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
    {selected && <ReportReviewDialog reportId={selected} activeAdminCount={activeAdminCount} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(); }} />}
  </div>;
}

function ReportReviewDialog({ reportId, activeAdminCount, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [resolutionNote, setResolutionNote] = useState('');
  const [itemAction, setItemAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suspendOpen, setSuspendOpen] = useState(false);
  useEffect(() => {
    moderationApi.report(reportId).then(({ data }) => { setReport(data); setStatus(data.status); setPriority(data.priority); setResolutionNote(data.resolutionNote || ''); })
      .catch((err) => setError(err.response?.data?.message || 'Report details could not be loaded.')).finally(() => setLoading(false));
  }, [reportId]);
  async function save(event) {
    event.preventDefault();
    if (itemAction && !window.confirm(itemAction === 'hide' ? 'Hide this item from campus listings?' : 'Restore this item to campus listings?')) return;
    setBusy(true); setError('');
    try {
      await moderationApi.reviewReport(reportId, { status, priority, resolutionNote, ...(itemAction ? { itemAction } : {}) });
      toast('Report review saved.'); onSaved();
    } catch (err) { setError(err.response?.data?.message || 'The report review could not be saved.'); }
    finally { setBusy(false); }
  }
  const final = report && ['resolved', 'dismissed'].includes(report.status);
  const targetUser = report?.targetType === 'user' ? report.target : report?.targetType === 'item' ? report.target?.owner : null;
  const cannotSuspend = !targetUser || !targetUser.isActive || targetUser.id === user?.id || (targetUser.role === 'admin' && activeAdminCount <= 1);

  return <div className="moderation-backdrop"><section className="moderation-dialog moderation-review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <div className="moderation-dialog-header"><div><span className="eyebrow">MODERATION CASE</span><h2 id="review-title">Review report</h2></div><button className="text-link" onClick={onClose}>Close</button></div>
    {loading && <p role="status">Loading report details…</p>}
    {error && <p className="moderation-form-error" role="alert">{error}</p>}
    {!loading && report && <>
      <div className="moderation-case-summary"><p><strong>Reason:</strong> {label(report.reason)}</p><p><strong>Target:</strong> {label(report.targetType)} · {report.targetId}</p><p><strong>Reporter:</strong> {report.reporter?.name || 'Campus member'}</p><p><strong>Submitted:</strong> {new Date(report.createdAt).toLocaleString()}</p><p><strong>Automatic score:</strong> {report.moderationScore}/100 {report.autoFlagged ? '· Flagged for review' : ''}</p>{report.flagSignals?.map((signal) => <small key={signal}>{signal}</small>)}</div>
      {report.target && <TargetSummary report={report} />}
      {!!report.reviewHistory?.length && <details className="moderation-audit"><summary>Review history ({report.reviewHistory.length})</summary>{report.reviewHistory.map((entry, index) => <p key={`${entry.at}-${index}`}>{label(entry.status)} · {label(entry.priority)} · {entry.actor?.name || 'Admin'} · {new Date(entry.at).toLocaleString()}{entry.note ? ` · ${entry.note}` : ''}</p>)}</details>}
      <form className="moderation-review-form" onSubmit={save}>
        <label htmlFor="review-status">Status</label><select id="review-status" value={status} disabled={final} onChange={(event) => setStatus(event.target.value)}>{(report.status === 'pending' ? statuses : [report.status, 'resolved', 'dismissed'].filter((value, index, list) => list.indexOf(value) === index)).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
        <label htmlFor="review-priority">Priority</label><select id="review-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <label htmlFor="resolution-note">Resolution note</label><textarea id="resolution-note" rows={3} maxLength={1000} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
        {report.targetType === 'item' && report.target && <label className="moderation-item-action">Reported item visibility<select value={itemAction} onChange={(event) => setItemAction(event.target.value)}><option value="">No visibility change</option><option value={report.target.isHidden ? 'unhide' : 'hide'}>{report.target.isHidden ? 'Restore item visibility' : 'Hide item from listings'}</option></select></label>}
        <div className="moderation-dialog-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button></div>
      </form>
      {targetUser && <div className="moderation-user-action"><strong>{report.targetType === 'user' ? 'Target account' : 'Item owner account'}</strong><p>{targetUser.name} · {targetUser.role} · {targetUser.isActive ? 'Active' : 'Suspended'}</p><button className="button button-danger" disabled={cannotSuspend || busy} onClick={() => setSuspendOpen(true)}>{targetUser.isActive ? 'Suspend target account' : 'Account suspended'}</button>{targetUser.id === user?.id && <small>You cannot suspend your own admin account.</small>}{targetUser.role === 'admin' && activeAdminCount <= 1 && <small>The last active administrator cannot be suspended.</small>}</div>}
    </>}
  </section>{suspendOpen && targetUser && <SuspendDialog user={targetUser} onClose={() => setSuspendOpen(false)} onSaved={() => { setSuspendOpen(false); toast('Account suspended.'); onClose(); }} />}</div>;
}

function TargetSummary({ report }) {
  const target = report.target;
  if (report.targetType === 'item') return <section className="moderation-target"><h3>Reported item</h3><p><strong>{target.title}</strong> · {target.type} · {target.status} {target.isHidden ? '· Hidden' : ''}</p><p>{target.description}</p><small>{target.category} · {target.location} · Owner: {target.owner?.name || 'Campus member'}</small>{!!target.moderationHistory?.length && <details className="moderation-audit"><summary>Item moderation history ({target.moderationHistory.length})</summary>{target.moderationHistory.map((entry, index) => <p key={`${entry.at}-${index}`}>{label(entry.action)} · {label(entry.reason)} · {entry.actor?.name || 'Admin'} · {new Date(entry.at).toLocaleString()}</p>)}</details>}</section>;
  if (report.targetType === 'user') return <section className="moderation-target"><h3>Reported account</h3><p>{target.name} · {target.role} · {target.isActive ? 'Active' : 'Suspended'}</p><small>Joined {new Date(target.createdAt).toLocaleDateString()}</small></section>;
  return <section className="moderation-target"><h3>Reported claim</h3><p>{target.item?.title || 'Found item'} · {target.status}</p><small>Claimant: {target.claimant?.name || 'Campus member'} · Item owner: {target.itemOwner?.name || 'Campus member'}</small></section>;
}

function SuspendDialog({ user, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy || reason.trim().length < 5) return;
    setBusy(true); setError('');
    try { await moderationApi.suspendUser(user.id, reason.trim()); onSaved(); }
    catch (err) { setError(err.response?.data?.message || 'Account could not be suspended.'); }
    finally { setBusy(false); }
  }
  return <div className="moderation-backdrop nested"><section className="moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
    <h2 id="suspend-title">Suspend {user.name}?</h2><p>The account will lose access immediately. Active listings will be hidden, pending claims handled, and history preserved.</p>
    <form onSubmit={submit}><label htmlFor="suspension-reason">Reason</label><textarea id="suspension-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} />{error && <p className="moderation-form-error" role="alert">{error}</p>}
      <div className="moderation-dialog-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-danger" disabled={busy || reason.trim().length < 5}>{busy ? 'Suspending…' : 'Confirm suspension'}</button></div>
    </form>
  </section></div>;
}

function AdminUsers() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await moderationApi.users({ active, page, limit: 20 })); setError(''); }
    catch (err) { setError(err.response?.data?.message || 'Users could not be loaded.'); }
    finally { setLoading(false); }
  }, [active, page]);
  useEffect(() => { void load(); }, [load]);
  function changeFilter(value) { setActive(value); setPage(1); }
  async function unsuspend(account) {
    try { await moderationApi.unsuspendUser(account.id); toast('Account restored.'); void load(); }
    catch (err) { setError(err.response?.data?.message || 'Account could not be restored.'); }
  }
  return <div className="moderation-list-panel">
    <div className="moderation-panel-heading"><div><span className="eyebrow">ACCOUNT ACCESS</span><h2>User management</h2><p>{users?.activeAdminCount ?? '—'} active administrators. At least one must remain active.</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    <div className="moderation-filters" aria-label="Account filters"><button className={active === 'true' ? 'active' : ''} onClick={() => changeFilter('true')}>Active</button><button className={active === 'false' ? 'active' : ''} onClick={() => changeFilter('false')}>Suspended</button></div>
    {loading && <p className="moderation-state" role="status">Loading users…</p>}{!loading && error && <p role="alert" className="moderation-state error">{error} <button onClick={() => void load()}>Try again</button></p>}
    {!loading && !error && !users?.data?.length && <p className="moderation-state">No accounts match this filter.</p>}
    {!loading && !error && !!users?.data?.length && <div className="moderation-user-list">{users.data.map((account) => {
      const self = account.id === currentUser?.id;
      const lastAdmin = account.role === 'admin' && account.isActive && users.activeAdminCount <= 1;
      return <article className="moderation-user-card" key={account.id}><div><strong>{account.name}</strong><span>{account.email}</span><small>{account.role} · {account.isActive ? 'Active' : 'Suspended'} · Joined {new Date(account.createdAt).toLocaleDateString()}</small>{!account.isActive && <small>Suspended {account.suspendedAt ? new Date(account.suspendedAt).toLocaleDateString() : ''} · {account.suspensionReason || 'No reason recorded'}</small>}</div>
        {account.isActive ? <button className="button button-danger" disabled={self || lastAdmin} title={self ? 'You cannot suspend yourself.' : lastAdmin ? 'At least one active admin must remain.' : ''} onClick={() => setSelected(account)}>Suspend</button> : <button className="button button-secondary" onClick={() => void unsuspend(account)}>Unsuspend</button>}
        {self && <small className="moderation-disabled-note">Current account</small>}{lastAdmin && <small className="moderation-disabled-note">Last active admin</small>}
      </article>;
    })}</div>}
    {!loading && !error && users?.pagination?.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {users.pagination.totalPages}</span><button disabled={page >= users.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
    {selected && <SuspendDialog user={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); toast('Account suspended.'); void load(); }} />}
  </div>;
}
