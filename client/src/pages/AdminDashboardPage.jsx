import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyticsApi } from '../services/api.js';
import AdminModerationPanel from './AdminModerationPanel.jsx';
import { useSearchParams } from 'react-router-dom';

const palette = ['#315b47', '#c17b52', '#7d9b72', '#d3ab55', '#7788a0', '#a87472', '#7b6f96', '#68999a', '#a3a97e', '#bc8752'];

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState(searchParams.get('tab') === 'moderation' ? 'moderation' : 'overview');
  function changeSection(value) {
    setSection(value);
    setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true });
  }
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, trends, categories, locations] = await Promise.all([analyticsApi.overview(), analyticsApi.trends(), analyticsApi.categories(), analyticsApi.locations()]);
      setData({ overview: overview.data, trends: trends.data, categories: categories.data || [], locations: locations.data || [] });
      setError('');
    } catch (err) { setError(err.response?.data?.message || 'Analytics could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pageHeader = <header className="admin-heading"><div><span className="eyebrow">CAMPUS OPERATIONS</span><h1>Admin Dashboard</h1><p>{section === 'overview' ? 'Aggregate report, recovery, and claim activity.' : 'Review abuse reports and manage account access.'}</p></div>{section === 'overview' && !loading && <button className="button button-secondary" onClick={() => void load()}>Refresh data</button>}</header>;
  const tabs = <div className="admin-section-tabs" role="tablist" aria-label="Admin dashboard"><button role="tab" aria-selected={section === 'overview'} onClick={() => changeSection('overview')}>Analytics</button><button role="tab" aria-selected={section === 'moderation'} onClick={() => changeSection('moderation')}>Moderation</button></div>;
  if (section === 'moderation') return <section className="admin-page">{pageHeader}{tabs}<AdminModerationPanel /></section>;
  if (loading) return <section className="admin-page">{pageHeader}{tabs}<div className="auth-loading" role="status">Loading campus analytics…</div></section>;
  if (error) return <section className="admin-page">{pageHeader}{tabs}<div className="matches-state matches-error" role="alert">{error} <button onClick={() => void load()}>Try again</button></div></section>;
  const overview = data.overview;
  const trendWeeks = data.trends.weeks || [];
  const categoryTotal = data.categories.reduce((sum, entry) => sum + entry.count, 0);
  const cards = [
    ['Total items', overview.totalItems], ['Lost items', overview.lostItems], ['Found items', overview.foundItems],
    ['Resolved items', overview.resolvedItems], ['Recovery rate', `${overview.recoveryRate}%`], ['Pending claims', overview.pendingClaims],
  ];
  return <section className="admin-page">
    {pageHeader}{tabs}
    <div className="admin-metrics">{cards.map(([label, value]) => <article className="admin-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <section className="admin-comparison"><strong>Report activity, most recent four weeks</strong><span>Current: {data.trends.comparison.current4WeekTotal}</span><span>Previous: {data.trends.comparison.previous4WeekTotal}</span><span>Change: {data.trends.comparison.percentageChange === null ? '—' : `${data.trends.comparison.percentageChange}%`}</span><small>Trend weeks use UTC Monday starts and include the current week.</small></section>
    <div className="admin-charts">
      <article className="admin-chart-card admin-chart-wide"><h2>8-week report and resolution trend</h2>{trendWeeks.some((entry) => entry.lost || entry.found || entry.resolved) ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendWeeks} margin={{ top: 10, right: 15, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e9ece5" /><XAxis dataKey="week" tick={{ fontSize: 9 }} tickFormatter={(date) => date.slice(5)} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="lost" name="Lost" stroke="#b56f55" strokeWidth={2} /><Line type="monotone" dataKey="found" name="Found" stroke="#315b47" strokeWidth={2} /><Line type="monotone" dataKey="resolved" name="Resolved" stroke="#d0a74e" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <p className="analytics-empty">No report activity in these weeks.</p>}</article>
      <article className="admin-chart-card"><h2>Category distribution</h2>{categoryTotal ? <div className="admin-chart admin-chart-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.categories.filter((entry) => entry.count > 0)} dataKey="count" nameKey="category" innerRadius="55%" outerRadius="78%" paddingAngle={2}>{data.categories.filter((entry) => entry.count > 0).map((entry, index) => <Cell key={entry.category} fill={palette[index % palette.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 9 }} /></PieChart></ResponsiveContainer></div> : <p className="analytics-empty">No items have been reported yet.</p>}</article>
      <article className="admin-chart-card"><h2>Top lost-item locations</h2>{data.locations.length ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.locations} layout="vertical" margin={{ top: 5, right: 20, left: 15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9ece5" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} /><YAxis dataKey="location" type="category" width={100} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="count" name="Lost reports" fill="#315b47" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <p className="analytics-empty">No lost-item locations to show.</p>}</article>
    </div>
    <p className="admin-privacy-note">This view contains aggregate counts only. Recovery rate is resolved lost reports divided by all lost reports.</p>
  </section>;
}
