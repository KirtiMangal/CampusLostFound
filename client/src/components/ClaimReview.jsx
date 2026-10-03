import { useEffect, useState } from 'react';
import { claimApi, itemApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import ReportDialog from './ReportDialog.jsx';

function readableDate(value) { return value ? new Date(value).toLocaleDateString() : ''; }

export default function ClaimReview({ itemId, onApproved, allowReport = true, itemHidden = false }) {
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [busyId, setBusyId] = useState('');
  const [reportClaimId, setReportClaimId] = useState('');

  async function loadClaims() {
    setLoading(true);
    try { setClaims((await itemApi.claims(itemId)).data || []); }
    catch (error) { toast.error(error.response?.data?.message || 'Claims could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadClaims(); }, [itemId]);

  async function review(claim, action) {
    setBusyId(claim.id);
    try {
      const result = action === 'approve' ? await claimApi.approve(claim.id) : await claimApi.reject(claim.id);
      setClaims((current) => current.map((entry) => entry.id === claim.id ? { ...entry, status: result.data.status } : entry));
      if (action === 'approve') {
        onApproved?.();
        const details = await claimApi.contact(claim.id);
        setContact((current) => ({ ...current, [claim.id]: details.data }));
        toast('Ownership claim approved. Contact information is now available to the authorized participants.');
      } else toast('This ownership claim was rejected.');
      void loadClaims();
    } catch (error) { toast.error(error.response?.data?.message || 'The claim could not be updated.'); }
    finally { setBusyId(''); }
  }

  return <section className="claim-panel claim-review-panel">
    <div className="claim-panel-heading"><div><h2>Ownership Claims</h2><p>Review the claimant’s identifying details. Matching scores do not prove ownership.</p></div><button className="button button-secondary" onClick={() => void loadClaims()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
    {loading && <p role="status">Loading claims…</p>}
    {!loading && !claims.length && <p className="claim-muted">No ownership claims have been submitted for this item.</p>}
    {!loading && itemHidden && !!claims.length && <p className="claim-muted">Claim approvals are paused while this item is hidden.</p>}
    {!loading && claims.map((claim) => <article className="claim-record" key={claim.id}>
      <div className="claim-record-heading"><strong>{claim.claimant?.name || 'Campus member'}</strong><span className={`claim-status claim-${claim.status}`}>{claim.status}</span></div>
      <p>{claim.claimMessage}</p><time>{readableDate(claim.createdAt)}</time>
      {claim.rejectionReason && <p className="claim-muted">Review note: {claim.rejectionReason}</p>}
      {claim.status === 'pending' && <div className="claim-actions"><button className="button button-primary" onClick={() => void review(claim, 'approve')} disabled={busyId === claim.id || itemHidden}>{busyId === claim.id ? 'Saving…' : 'Approve'}</button><button className="button button-secondary" onClick={() => void review(claim, 'reject')} disabled={busyId === claim.id}>Reject</button></div>}
      {allowReport && <button className="text-link claim-report-action" onClick={() => setReportClaimId(claim.id)}>Report this claim</button>}
      {contact[claim.id] && <p className="claim-contact"><strong>Approved participant contact</strong><br />{contact[claim.id].name} · <a href={`mailto:${contact[claim.id].email}`}>{contact[claim.id].email}</a></p>}
    </article>)}
    {reportClaimId && <ReportDialog targetType="claim" targetId={reportClaimId} onClose={() => setReportClaimId('')} />}
  </section>;
}
