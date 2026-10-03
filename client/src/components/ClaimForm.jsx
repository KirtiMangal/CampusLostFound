import { useState } from 'react';
import { itemApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

const LIMIT = 2000;

export default function ClaimForm({ itemId }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const claimMessage = message.trim();
    if (!claimMessage) return;
    setSubmitting(true);
    try {
      await itemApi.createClaim(itemId, { claimMessage });
      setSubmitted(true);
      toast('Your ownership claim has been submitted for review.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Your claim could not be submitted.');
    } finally { setSubmitting(false); }
  }

  if (submitted) return <section className="claim-panel" role="status"><h2>Claim submitted</h2><p>Your ownership claim is pending review by the person who found this item.</p><span className="claim-status claim-pending">Pending</span></section>;
  return <section className="claim-panel">
    <h2>Submit Ownership Claim</h2>
    <p>AI matches are only suggestions. Explain details that help the finder verify the item belongs to you.</p>
    <form className="claim-form" onSubmit={submit}>
      <label htmlFor="claim-message">Why do you believe this item is yours?</label>
      <textarea id="claim-message" value={message} maxLength={LIMIT} onChange={(event) => setMessage(event.target.value)} placeholder="Mention identifying details that only the owner is likely to know." required rows={5} />
      <div className="claim-form-footer"><span>{message.length}/{LIMIT}</span><button className="button button-primary" disabled={submitting || !message.trim()}>{submitting ? 'Submitting…' : 'Submit claim'}</button></div>
    </form>
  </section>;
}
