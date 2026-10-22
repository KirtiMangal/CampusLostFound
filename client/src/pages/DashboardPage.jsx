import { useEffect, useState } from 'react';
import { ArrowRight, Bell, BellRing, BriefcaseBusiness, Check, CirclePlus, FileCheck2, FilePlus2, FolderOpen, LayoutDashboard, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { claimApi, itemApi, notificationApi } from '../services/api.js';
import MatchCard from '../components/MatchCard.jsx';
import ReportDialog from '../components/ReportDialog.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState(null);
  const [myClaims, setMyClaims] = useState([]);
  const [receivedClaims, setReceivedClaims] = useState([]);
  const [claimContacts, setClaimContacts] = useState({});
  const [reportClaimId, setReportClaimId] = useState('');
  const [reports, setReports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([
      itemApi.list({ mine: true, status: 'active', limit: 1 }),
      itemApi.list({ mine: true, status: 'resolved', limit: 1 }),
    ]).then(([active, resolved]) => {
      if (current) setCounts({ active: active.pagination.total, resolved: resolved.pagination.total, total: active.pagination.total + resolved.pagination.total });
    }).catch((error) => {
      if (current) toast.error(error.response?.data?.message || 'Your report counts are temporarily unavailable.');
    });

    Promise.all([claimApi.mine(), claimApi.received()]).then(([mine, received]) => {
      if (current) { setMyClaims(mine.data || []); setReceivedClaims(received.data || []); }
    }).catch((error) => { if (current) toast.error(error.response?.data?.message || 'Your ownership claims are temporarily unavailable.'); });

    itemApi.list({ mine: true, limit: 5 }).then(async (result) => {
      if (!current) return;
      setReports(result.items || []);
      const reportItems = (result.items || []).slice(0, 3);
      const results = await Promise.all(reportItems.map((item) => itemApi.matches(item.id).catch(() => ({ data: [] }))));
      if (!current) return;
      const unique = new Map();
      results.forEach((result) => (result.data || []).forEach((match) => {
        if (!unique.has(match.item.id)) unique.set(match.item.id, match);
      }));
      setMatches([...unique.values()].sort((a, b) => b.finalScore - a.finalScore).slice(0, 3));
    }).catch(() => { if (current) setReports([]); });

    Promise.all([notificationApi.list({ page: 1, limit: 4 }), notificationApi.unreadCount()]).then(([list, count]) => {
      if (current) { setNotifications(list.data || []); setUnreadCount(count.count || 0); }
    }).catch(() => { if (current) { setNotifications([]); setUnreadCount(0); } });

    return () => { current = false; };
  }, [toast]);

  async function cancelClaim(claim) {
    try {
      await claimApi.cancel(claim.id);
      setMyClaims((claims) => claims.map((entry) => entry.id === claim.id ? { ...entry, status: 'cancelled' } : entry));
      toast('Your claim has been cancelled.');
    } catch (error) { toast.error(error.response?.data?.message || 'The claim could not be cancelled.'); }
  }

  async function showContact(claim) {
    try {
      const result = await claimApi.contact(claim.id);
      setClaimContacts((contacts) => ({ ...contacts, [claim.id]: result.data }));
    } catch (error) { toast.error(error.response?.data?.message || 'Contact information is unavailable.'); }
  }

  const pendingClaims = receivedClaims.filter((claim) => claim.status === 'pending').length;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return <div className="dashboard-workspace" id="dashboard-top">
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <div className="dashboard-sidebar-label">WORKSPACE</div>
      <a className="dashboard-side-link is-active" href="#dashboard-top"><LayoutDashboard size={19} /> Dashboard</a>
      <Link className="dashboard-side-link dashboard-side-lost" to="/report/lost"><CirclePlus size={19} /> Report lost</Link>
      <Link className="dashboard-side-link dashboard-side-found" to="/report/found"><CirclePlus size={19} /> Report found</Link>
      <a className="dashboard-side-link" href="#my-reports"><FolderOpen size={19} /> My reports</a>
      <a className="dashboard-side-link" href="#my-claims"><FileCheck2 size={19} /> My claims</a>
      <a className="dashboard-side-link dashboard-side-matches" href="#suggested-matches"><Sparkles size={19} /> Matches</a>
      <Link className="dashboard-side-link" to="/notifications"><Bell size={19} /> Notifications</Link>
      <a className="dashboard-side-link" href="#account"><UserRound size={19} /> My account</a>
      <div className="dashboard-trust-card"><ShieldCheck size={19} /><strong>Campus Trust Network</strong><p>Your contact details stay private until a claim is approved.</p></div>
    </aside>

    <div className="dashboard-main">
      <section className="dashboard-welcome">
        <div><span className="dashboard-welcome-kicker">STUDENT DASHBOARD</span><h1>Welcome back, {firstName}!</h1><p>Track your reports, review ownership claims, and check possible matches.</p></div>
        <div className="dashboard-welcome-actions"><Link className="dashboard-report-button dashboard-report-lost" to="/report/lost"><CirclePlus size={17} /> Report lost</Link><Link className="dashboard-report-button dashboard-report-found" to="/report/found"><CirclePlus size={17} /> Report found</Link></div>
      </section>

      <section className="dashboard-summary-grid" aria-label="Account overview">
        <article className="dashboard-summary-card"><div><span>ACTIVE REPORTS</span><strong>{counts ? counts.active : '—'}</strong><small>Your live listings</small></div><i><FilePlus2 size={24} /></i></article>
        <article className="dashboard-summary-card"><div><span>CLAIMS PENDING</span><strong>{pendingClaims}</strong><small>Awaiting your review</small></div><i><FileCheck2 size={24} /></i></article>
        <article className="dashboard-summary-card"><div><span>MY CLAIMS</span><strong>{myClaims.length}</strong><small>Submitted by you</small></div><i><FolderOpen size={24} /></i></article>
        <article className="dashboard-summary-card"><div><span>UNREAD ALERTS</span><strong>{unreadCount}</strong><small>Notifications</small></div><i><BellRing size={24} /></i></article>
      </section>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel dashboard-matches-panel" id="suggested-matches">
          <div className="dashboard-panel-heading"><div><h2><Sparkles size={21} /> AI suggested matches</h2><p>Possible connections for the reports you’ve shared.</p></div><a href="#my-reports">Your reports <ArrowRight size={15} /></a></div>
          {matches.length ? <div className="dashboard-matches-list">{matches.map((match) => <MatchCard key={match.matchId} match={match} />)}</div> : <div className="dashboard-empty-state"><i><Sparkles size={24} /></i><strong>No pending matches</strong><p>We compare your reports with new campus listings and show suggestions here.</p><Link to="/report/lost">Create a report <ArrowRight size={15} /></Link></div>}
        </section>

        <div className="dashboard-side-panels">
          <section className="dashboard-panel dashboard-notifications-panel">
            <div className="dashboard-panel-heading"><h2>Recent notifications</h2><Link to="/notifications">All alerts</Link></div>
            {notifications.length ? <ul className="dashboard-notification-list">{notifications.slice(0, 3).map((notification) => <li key={notification.id} className={notification.isRead ? '' : 'is-unread'}><span className="dashboard-notification-dot"></span><div><strong>{notification.title}</strong><p>{notification.message}</p></div></li>)}</ul> : <p className="dashboard-panel-empty">You’re all caught up. New updates will appear here.</p>}
          </section>
          <section className="dashboard-panel dashboard-shortcuts-panel">
            <h2>Quick shortcuts</h2>
            <Link to="/items">Browse campus reports <ArrowRight size={16} /></Link>
            <a href="#my-reports">Manage my reports <ArrowRight size={16} /></a>
            <a href="#my-claims">Track my claims <ArrowRight size={16} /></a>
          </section>
        </div>
      </div>

      <section className="dashboard-panel dashboard-reports-panel" id="my-reports">
        <div className="dashboard-panel-heading"><div><h2><BriefcaseBusiness size={20} /> My reports</h2><p>{counts ? `${counts.total} report${counts.total === 1 ? '' : 's'} in your account` : 'Your campus reports'}</p></div><Link to="/items">View reports <ArrowRight size={15} /></Link></div>
        {reports.length ? <div className="dashboard-report-list">{reports.slice(0, 4).map((report) => <Link className="dashboard-report-row" to={`/items/${report.id}`} key={report.id}><span className={`dashboard-report-type type-${report.type}`}>{report.type}</span><span className="dashboard-report-title">{report.title}</span><span className={`status-badge status-${report.status}`}>{report.status}</span><span className="dashboard-report-location">{report.location}</span><ArrowRight size={16} /></Link>)}</div> : <p className="dashboard-panel-empty">You haven’t added any reports yet. Start by reporting a lost or found item.</p>}
      </section>

      <section className="dashboard-panel dashboard-claims-panel" id="my-claims">
        <div className="dashboard-panel-heading"><div><h2><FileCheck2 size={20} /> My claims</h2><p>Review claims you’ve made and requests on your reports.</p></div></div>
        <div className="dashboard-claims-columns">
          <section aria-labelledby="my-claims-title"><h3 id="my-claims-title">Claims I submitted</h3>
            {!myClaims.length && <p className="dashboard-panel-empty">You have not submitted any ownership claims.</p>}
            {myClaims.map((claim) => <article className="dashboard-claim-row" key={claim.id}>
              <div><Link to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>{claim.item?.title || 'Found item'}</Link><span className={`claim-status claim-${claim.status}`}>{claim.status}</span><small>{new Date(claim.createdAt).toLocaleDateString()}</small></div>
              <div className="dashboard-claim-actions">{claim.status === 'pending' && <button className="button button-secondary" onClick={() => void cancelClaim(claim)}>Cancel claim</button>}<button className="text-link claim-report-action" onClick={() => setReportClaimId(claim.id)}>Report claim</button>{claim.status === 'approved' && !claimContacts[claim.id] && <button className="button button-secondary" onClick={() => void showContact(claim)}>View finder contact</button>}</div>
              {claimContacts[claim.id] && <p className="claim-contact">{claimContacts[claim.id].name} · <a href={`mailto:${claimContacts[claim.id].email}`}>{claimContacts[claim.id].email}</a></p>}
            </article>)}
          </section>
          <section aria-labelledby="claims-on-items-title"><h3 id="claims-on-items-title">Claims on my reports <span>{pendingClaims} pending</span></h3>
            {!receivedClaims.length && <p className="dashboard-panel-empty">There are no claims on your found items.</p>}
            {receivedClaims.map((claim) => <article className="dashboard-claim-row" key={claim.id}><div><Link to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>{claim.item?.title || 'Found item'}</Link><span className={`claim-status claim-${claim.status}`}>{claim.status}</span><small>Claim from {claim.claimant?.name || 'Campus member'}</small></div><Link className="button button-secondary" to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>Review item</Link></article>)}
          </section>
        </div>
      </section>

      <section className="dashboard-account-panel" id="account"><div><span>MY ACCOUNT</span><strong>{user?.name}</strong><p>{user?.email}</p></div><span className="dashboard-account-role"><ShieldCheck size={16} /> {user?.role}</span></section>
      <div className="dashboard-bottom-actions"><Link className="text-link" to="/report/lost">Report a lost item <ArrowRight size={15} /></Link><Link className="text-link" to="/report/found">Report a found item <ArrowRight size={15} /></Link>{counts && <span><Check size={15} /> {counts.resolved} item{counts.resolved === 1 ? '' : 's'} returned to their owners</span>}</div>
    </div>
    {reportClaimId && <ReportDialog targetType="claim" targetId={reportClaimId} onClose={() => setReportClaimId('')} />}
  </div>;
}
