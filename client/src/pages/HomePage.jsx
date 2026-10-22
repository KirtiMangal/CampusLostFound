import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Check, Compass, FileSearch, HeartHandshake, KeyRound, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

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

    <section className="home-capabilities">
      <div className="home-capabilities-intro"><div className="home-kicker home-kicker-light">THOUGHTFUL BY DESIGN</div><h2>Helpful technology.<br /><em>Human decisions.</em></h2><p>CampusFind helps people notice possible connections while leaving claims and handovers in the right hands.</p><Link to="/items" className="home-text-link">Browse campus reports <ArrowRight size={16} /></Link></div>
      <div className="home-capability-list">{capabilities.map(({ icon: Icon, title, text }, index) => <article className="home-capability" key={title}><span className="home-capability-icon"><Icon size={19} /></span><div><div className="home-capability-index">0{index + 1}</div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight className="home-capability-arrow" size={17} /></article>)}</div>
    </section>

    <section className="home-final-cta"><div className="home-final-icon"><HeartHandshake size={22} /></div><div><div className="home-kicker">YOUR CAMPUS COMMUNITY IS HERE</div><h2>Every detail can help.</h2><p>Start with what you remember. You can update a report as you learn more.</p></div><Link to="/report/lost" className="home-button home-button-primary">Create a report <ArrowUpRight size={17} /></Link></section>
  </div>;
}
