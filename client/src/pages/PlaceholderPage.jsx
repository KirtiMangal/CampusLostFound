import { ArrowLeft, ArrowUpRight, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title, description }) {
  return <section className="placeholder-wrap"><div className="placeholder-card"><div className="placeholder-icon"><Compass size={25} strokeWidth={1.5} /></div><div className="eyebrow">CAMPUS / FOUND</div><h1>{title}</h1><p>{description}</p><div className="placeholder-actions"><Link to="/" className="button button-primary"><ArrowLeft size={16} /> Back home</Link><Link to="/items" className="text-link">Explore the portal <ArrowUpRight size={15} /></Link></div></div></section>;
}
