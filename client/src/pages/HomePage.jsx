import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Check, CircleCheck, Compass, FileSearch, HeartHandshake, KeyRound, LayoutDashboard, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { itemApi } from '../services/api.js';

const steps = [
  { icon: FileSearch, number: '01', title: 'Create a clear report', text: 'Add the details you remember, when and where it happened, and a photo if you have one.' },
  { icon: Sparkles, number: '02', title: 'Review possible matches', text: 'Related lost and found reports are surfaced using item, place, date, and description details.' },
  { icon: HeartHandshake, number: '03', title: 'Verify before reconnecting', text: 'The item owner reviews a claim. Contact details stay private until a claim is approved.' },
];

const capabilities = [
  { icon: Compass, title: 'Made for campus', text: 'Search reports by what the item is and where it was last seen.' },
  { icon: BellRing, title: 'Useful updates', text: 'Get in-app notifications when a possible match or claim needs your attention.' },
  { icon: ShieldCheck, title: 'Privacy by design', text: 'Personal contact information is shared only through an approved claim.' },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [recentItems, setRecentItems] = useState([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  useEffect(() => {
    let current = true;
    itemApi.featured().then(({ items }) => {
      if (current) setRecentItems(items || []);
    }).catch(() => {
      if (current) setRecentItems([]);
    }).finally(() => {
      if (current) setItemsLoaded(true);
    });
    return () => { current = false; };
  }, []);

  const browsePath = isAuthenticated ? '/items' : '/login';

  return <div className="home-refresh">
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="home-kicker"><span className="home-kicker-mark"><Sparkles size={13} /></span> CAMPUS LOST &amp; FOUND, MADE SIMPLE</div>
        <h1>Lost something<br />on campus? <em>Start here.</em></h1>
        <p className="home-lede">A single place to report belongings, find related listings, and help campus items make their way home.</p>
        <div className="home-hero-actions">
          <Link to="/report/lost" className="home-button home-button-primary">Report a lost item <ArrowUpRight size={17} /></Link>
          <Link to="/report/found" className="home-button home-button-outline">I found an item <ArrowRight size={16} /></Link>
        </div>
        <div className="home-assurance"><ShieldCheck size={16} /><span>Private claims. Human-verified handovers.</span></div>
      </div>

      <div className="home-visual" aria-label="Illustration showing how CampusFind connects lost and found item reports">
        <div className="home-visual-grid"></div>
        <div className="visual-label visual-label-top"><span className="status-pulse"></span> ONE CAMPUS, CONNECTED</div>
        <div className="visual-orbit visual-orbit-a"></div><div className="visual-orbit visual-orbit-b"></div>
        <div className="visual-center"><div className="visual-center-icon"><Search size={33} strokeWidth={1.5} /></div><strong>Find the connection</strong><span>Lost report <ArrowRight size={12} /> Found report</span></div>
        <div className="visual-item visual-item-lost"><span className="visual-item-type">LOST REPORT</span><span className="visual-item-icon visual-icon-amber"><KeyRound size={24} /></span><strong>Keys &amp; essentials</strong><small><MapPin size={12} /> Around campus</small><span className="visual-item-foot">Details help narrow the search</span></div>
        <div className="visual-item visual-item-found"><span className="visual-item-type">FOUND REPORT</span><span className="visual-item-icon visual-icon-green"><Compass size={24} /></span><strong>Found something?</strong><small><MapPin size={12} /> Share where it was found</small><span className="visual-item-foot"><Check size={13} /> Owner reviews any claim</span></div>
        <div className="visual-note"><span><ShieldCheck size={16} /></span><div><strong>Contact stays private</strong><small>Until a claim is approved</small></div></div>
        <div className="visual-label visual-label-bottom">CLEAR DETAILS. CAREFUL HANDOVER.</div>
      </div>
      <a className="home-scroll-cue" href="#how-it-works"><ArrowDownRight size={15} /> HOW IT WORKS</a>
    </section>

    <section className="home-proofline" aria-label="CampusFind principles">
      <span>BUILT AROUND TRUST</span><i></i><p>Good reporting helps the right belongings find their people.</p><Link to="/items">Explore reports <ArrowUpRight size={15} /></Link>
    </section>

    <section className="home-process" id="how-it-works">
      <div className="home-section-heading"><div><div className="home-kicker">A CLEAR PATH FOR EVERY REPORT</div><h2>From “I lost it”<br />to <em>back where it belongs.</em></h2></div><p>Simple steps help students share useful details, review possible connections, and verify ownership responsibly.</p></div>
      <div className="home-steps-grid">{steps.map(({ icon: Icon, number, title, text }) => <article className="home-step" key={number}><div className="home-step-top"><span>{number}</span><Icon size={20} strokeWidth={1.7} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="home-listings" aria-labelledby="home-listings-title">
      <div className="home-section-heading home-listings-heading"><div><div className="home-kicker">RECENT ACTIVITY</div><h2 id="home-listings-title">Latest reports<br />from your campus.</h2></div><Link className="home-text-link" to={browsePath}>{isAuthenticated ? 'Browse all reports' : 'Sign in to browse'} <ArrowRight size={16} /></Link></div>
      {recentItems.length ? <div className="home-listings-grid">{recentItems.map((item) => <article className="home-listing-card" key={item.id}>
        <div className="home-listing-image-wrap">
          {item.images?.[0]?.url ? <img className="home-listing-image" src={item.images[0].url} alt="" loading="lazy" /> : <div className="home-listing-image-empty"><Compass size={30} strokeWidth={1.5} /><span>No photo provided</span></div>}
          <span className={`home-listing-type home-listing-${item.type}`}>{item.type}</span><span className="home-listing-status"><CircleCheck size={13} /> Active</span>
        </div>
        <div className="home-listing-content"><span className="home-listing-category">{item.category}</span><h3>{item.title}</h3><div className="home-listing-meta"><span><MapPin size={14} />{item.location}</span><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div></div>
      </article>)}</div> : <div className="home-listings-empty"><Compass size={23} /><p>{itemsLoaded ? 'New campus reports will appear here as soon as they are shared.' : 'Loading recent campus reports…'}</p></div>}
      {!isAuthenticated && <p className="home-listings-note"><ShieldCheck size={14} /> Sign in to browse reports and view their details.</p>}
    </section>

    <section className="home-dashboard-preview" aria-labelledby="home-dashboard-title">
      <div className="home-dashboard-copy"><div className="home-kicker">ONE PLACE TO FOLLOW THROUGH</div><h2 id="home-dashboard-title">A clearer view of every report.</h2><p>Keep your reports, possible matches, and claim updates together in a simple campus dashboard.</p><ul><li><Check size={16} /> Check the status of your reports</li><li><Check size={16} /> Review possible matches and claims</li><li><Check size={16} /> Keep handover contact private</li></ul><Link className="home-button home-button-primary" to={isAuthenticated ? '/dashboard' : '/register'}>{isAuthenticated ? 'Open your dashboard' : 'Create your account'} <ArrowUpRight size={16} /></Link></div>
      <div className="dashboard-preview" aria-label="Illustrative preview of the CampusFind dashboard">
        <div className="dashboard-preview-sidebar"><span className="dashboard-preview-logo">c<span>+</span></span><div className="dashboard-preview-nav active"><LayoutDashboard size={15} /> Dashboard</div><div className="dashboard-preview-nav"><FileSearch size={15} /> My reports</div><div className="dashboard-preview-nav"><Sparkles size={15} /> Matches</div><div className="dashboard-preview-nav"><BellRing size={15} /> Updates</div><div className="dashboard-preview-privacy"><ShieldCheck size={15} /><span>Privacy-first claims</span></div></div>
        <div className="dashboard-preview-main"><div className="dashboard-preview-welcome"><span>YOUR CAMPUS DASHBOARD</span><strong>Everything in one place.</strong><small>Reports, matches, and claim updates.</small></div><div className="dashboard-preview-stats"><div><span>MY REPORTS</span><strong><FileSearch size={17} /> Track your items</strong></div><div><span>POSSIBLE MATCHES</span><strong><Sparkles size={17} /> Review suggestions</strong></div><div><span>CLAIM UPDATES</span><strong><CircleCheck size={17} /> Follow each claim</strong></div></div><div className="dashboard-preview-lower"><div><span>RECENT ACTIVITY</span><p><i></i> Your reports and updates appear here.</p><p><i></i> We’ll notify you when something needs attention.</p></div><div className="dashboard-preview-shield"><ShieldCheck size={19} /><span>Your contact details stay private until a claim is approved.</span></div></div></div>
      </div>
    </section>

    <section className="home-capabilities">
      <div className="home-capabilities-intro"><div className="home-kicker home-kicker-light">THOUGHTFUL BY DESIGN</div><h2>Helpful technology.<br /><em>Human decisions.</em></h2><p>CampusFind helps people notice possible connections while leaving claims and handovers in the right hands.</p><Link to="/items" className="home-text-link">Browse campus reports <ArrowRight size={16} /></Link></div>
      <div className="home-capability-list">{capabilities.map(({ icon: Icon, title, text }, index) => <article className="home-capability" key={title}><span className="home-capability-icon"><Icon size={19} /></span><div><div className="home-capability-index">0{index + 1}</div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight className="home-capability-arrow" size={17} /></article>)}</div>
    </section>

    <section className="home-final-cta"><div className="home-final-icon"><HeartHandshake size={22} /></div><div><div className="home-kicker">YOUR CAMPUS COMMUNITY IS HERE</div><h2>Every detail can help.</h2><p>Start with what you remember. You can update a report as you learn more.</p></div><Link to="/report/lost" className="home-button home-button-primary">Create a report <ArrowUpRight size={17} /></Link></section>
  </div>;
}
