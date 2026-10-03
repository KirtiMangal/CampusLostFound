import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ItemCard({ item }) {
  return <article className="item-card">
    <div className="item-card-top"><span className={`type-badge type-${item.type}`}>{item.type}</span><span className={`status-badge status-${item.status}`}>{item.status}</span></div>
    <h2><Link to={`/items/${item.id}`}>{item.title}</Link></h2>
    <p className="item-card-description">{item.description}</p>
    <div className="item-meta"><span>{item.category}</span><span><MapPin size={13} />{item.location}</span></div>
    <div className="item-card-bottom"><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString()}</span><span>{item.owner?.name ? `Reported by ${item.owner.name}` : ''}</span><Link className="item-open" to={`/items/${item.id}`} aria-label={`View ${item.title}`}><ArrowUpRight size={17} /></Link></div>
  </article>;
}
