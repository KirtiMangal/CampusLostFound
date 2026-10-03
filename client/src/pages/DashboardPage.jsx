import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpenCheck, FilePlus2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { claimApi, itemApi } from '../services/api.js';
import ReportDialog from '../components/ReportDialog.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [counts, setCounts] = useState(null);
  const [myClaims, setMyClaims] = useState([]);
  const [receivedClaims, setReceivedClaims] = useState([]);
  const [claimContacts, setClaimContacts] = useState({});
  const [reportClaimId, setReportClaimId] = useState('');

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

  return <section className="dashboard-wrap"><div className="dashboard-card">
    <div className="dashboard-icon"><ShieldCheck size={23} strokeWidth={1.6} /></div>
    <div className="eyebrow">YOUR CAMPUS / FOUND ACCOUNT</div>
    <h1>Good to have you, <span className="serif-accent">{user.name.split(' ')[0]}.</span></h1>
    <p className="dashboard-email">{user.email}</p>
    <div className="account-role"><span>Account role</span><strong>{user.role}</strong></div>
    <div className="dashboard-stats" aria-label="Your report statistics">
      <div><span><FilePlus2 size={15} /> Active</span><strong>{counts ? counts.active : '—'}</strong></div>
      <div><span><BookOpenCheck size={15} /> Resolved</span><strong>{counts ? counts.resolved : '—'}</strong></div>
      <div><span>Total reports</span><strong>{counts ? counts.total : '—'}</strong></div>
    </div>
    <section className="dashboard-claims" aria-labelledby="my-claims-title">
      <h2 id="my-claims-title">My Claims</h2>
      {!myClaims.length && <p className="claim-muted">You have not submitted any ownership claims.</p>}
      {myClaims.map((claim) => <article className="dashboard-claim-row" key={claim.id}>
        <div><Link to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>{claim.item?.title || 'Found item'}</Link><span className={`claim-status claim-${claim.status}`}>{claim.status}</span><small>{new Date(claim.createdAt).toLocaleDateString()}</small></div>
        {claim.status === 'pending' && <button className="button button-secondary" onClick={() => void cancelClaim(claim)}>Cancel claim</button>}
        <button className="text-link claim-report-action" onClick={() => setReportClaimId(claim.id)}>Report claim</button>
        {claim.status === 'approved' && !claimContacts[claim.id] && <button className="button button-secondary" onClick={() => void showContact(claim)}>View finder contact</button>}
        {claimContacts[claim.id] && <p className="claim-contact">{claimContacts[claim.id].name} · <a href={`mailto:${claimContacts[claim.id].email}`}>{claimContacts[claim.id].email}</a></p>}
      </article>)}
    </section>
    {reportClaimId && <ReportDialog targetType="claim" targetId={reportClaimId} onClose={() => setReportClaimId('')} />}
    <section className="dashboard-claims" aria-labelledby="claims-on-items-title">
      <h2 id="claims-on-items-title">Claims on My Items <span>{receivedClaims.filter((claim) => claim.status === 'pending').length} pending</span></h2>
      {!receivedClaims.length && <p className="claim-muted">There are no claims on your found items.</p>}
      {receivedClaims.map((claim) => <article className="dashboard-claim-row" key={claim.id}>
        <div><Link to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>{claim.item?.title || 'Found item'}</Link><span className={`claim-status claim-${claim.status}`}>{claim.status}</span><small>Claim from {claim.claimant?.name || 'Campus member'}</small></div>
        <Link className="button button-secondary" to={claim.item?.id ? `/items/${claim.item.id}` : '/items'}>Review item</Link>
      </article>)}
    </section>
    <div className="dashboard-actions"><Link className="button button-primary" to="/report/lost">Report lost <ArrowUpRight size={16} /></Link><Link className="button button-secondary" to="/items">Browse reports</Link></div>
  </div></section>;
}
