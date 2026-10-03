import { useCallback, useEffect, useState } from 'react';
import { itemApi } from '../services/api.js';
import MatchCard from './MatchCard.jsx';

export default function PotentialMatches({ itemId, enabled }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    setLoading(true);
    setError('');
    itemApi.matches(itemId).then((result) => { if (current) setMatches(result.data || []); })
      .catch((err) => { if (current) setError(err.response?.data?.message || 'Potential matches could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [enabled, itemId, reload]);

  if (!enabled) return null;
  return <section className="potential-matches" aria-labelledby="potential-matches-title">
    <div className="potential-matches-heading"><div><span className="eyebrow">For this report</span><h2 id="potential-matches-title">Potential Matches</h2><p>These reports share details with yours. Review them and confirm in person.</p></div><button className="button button-secondary" type="button" onClick={refresh} disabled={loading}>{loading ? 'Checking…' : 'Check again'}</button></div>
    {loading && <p className="matches-state" role="status">Loading potential matches…</p>}
    {!loading && error && <div className="matches-state matches-error" role="alert">{error} <button type="button" onClick={refresh}>Try again</button></div>}
    {!loading && !error && !matches.length && <p className="matches-state">No potential matches found yet. Check again later as new reports are added.</p>}
    {!loading && !error && !!matches.length && <div className="matches-list">{matches.map((match) => <MatchCard key={match.matchId} match={match} />)}</div>}
  </section>;
}
