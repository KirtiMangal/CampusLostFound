import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { ITEM_CATEGORIES } from '../../../shared/itemConstants.js';
import ItemCard from '../components/ItemCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { itemApi } from '../services/api.js';

const initialQuery = { page: 1, limit: 9, sort: 'newest' };

export default function ItemsPage() {
  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [data, setData] = useState({ items: [], pagination: { page: 1, limit: 9, total: 0, totalPages: 0 } });
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let current = true;
    setLoading(true);
    itemApi.list(query).then((result) => {
      if (current) setData(result);
    }).catch((error) => {
      if (current) toast.error(error.response?.data?.message || 'Items could not be loaded. Please try again.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [query, toast]);

  function applySearch(event) {
    event.preventDefault();
    setQuery((current) => ({ ...current, page: 1, search: searchInput.trim() || undefined, location: locationInput.trim() || undefined }));
  }

  function updateFilter(key, value) {
    setQuery((current) => ({ ...current, page: 1, [key]: value || undefined }));
  }

  function clearFilters() {
    setSearchInput('');
    setLocationInput('');
    setQuery(initialQuery);
  }

  const { pagination, items } = data;
  return <section className="items-page">
    <div className="items-heading"><div><div className="eyebrow">LOOKING FOR A WAY BACK</div><h1>Campus <span className="serif-accent">finds.</span></h1><p>Lost something, found something? Start with the details you remember.</p></div><div className="items-count"><strong>{pagination.total}</strong><span>community reports</span></div></div>
    <div className="discovery-panel">
      <form className="item-search-form" onSubmit={applySearch}>
        <label className="search-box"><Search size={17} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name, details, or place" aria-label="Search item reports" /><button className="search-button" type="submit">Search</button></label>
        <label className="location-box"><span>Location</span><input value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder="Any campus location" aria-label="Filter by exact campus location" /></label>
      </form>
      <div className="filter-row"><span className="filter-label"><SlidersHorizontal size={14} /> Filter by</span>
        <select aria-label="Filter by type" value={query.type || ''} onChange={(event) => updateFilter('type', event.target.value)}><option value="">Lost &amp; found</option><option value="lost">Lost</option><option value="found">Found</option></select>
        <select aria-label="Filter by category" value={query.category || ''} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{ITEM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
        <select aria-label="Filter by status" value={query.status || ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="resolved">Resolved</option></select>
        <select aria-label="Sort reports" value={query.sort || 'newest'} onChange={(event) => updateFilter('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <button type="button" className="clear-filter" onClick={clearFilters}>Clear</button>
      </div>
    </div>
    {loading ? <div className="items-empty" role="status">Finding campus reports…</div> : items.length ? <div className="items-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <div className="items-empty"><div className="empty-symbol">⌕</div><h2>No reports match just yet.</h2><p>Try a different search or clear a filter to see more campus reports.</p><button className="button button-secondary" onClick={clearFilters}>Clear search and filters</button></div>}
    {pagination.totalPages > 1 && <nav className="pagination" aria-label="Item report pages"><button disabled={pagination.page <= 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={15} /> Previous</button><span>Page <strong>{pagination.page}</strong> of {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>Next <ArrowRight size={15} /></button></nav>}
  </section>;
}
