import { useState } from 'react';
import { reportApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

const reasons = [
  ['spam', 'Spam'], ['fake_information', 'Fake information'], ['harassment', 'Harassment'],
  ['inappropriate_content', 'Inappropriate content'], ['fraudulent_claim', 'Fraudulent claim'],
  ['duplicate_listing', 'Duplicate listing'], ['other', 'Other'],
];

export default function ReportDialog({ targetType, targetId, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!reason) { setError('Choose a reason for this report.'); return; }
    setBusy(true);
    setError('');
    try {
      await reportApi.create({ targetType, targetId, reason, description: description.trim() });
      toast('Your report was submitted for review.');
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'The report could not be submitted.'); }
    finally { setBusy(false); }
  }

  return <div className="moderation-backdrop"><section className="moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
    <h2 id="report-dialog-title">Report this {targetType}</h2>
    <p>Tell the CampusFind team what should be reviewed. Reports are private.</p>
    <form onSubmit={submit}>
      <label htmlFor="report-reason">Reason</label>
      <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} required>
        <option value="">Choose a reason</option>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="report-description">Additional details <span>(optional)</span></label>
      <textarea id="report-description" rows={4} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
      {error && <p className="moderation-form-error" role="alert">{error}</p>}
      <div className="moderation-dialog-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-danger" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button></div>
    </form>
  </section></div>;
}
