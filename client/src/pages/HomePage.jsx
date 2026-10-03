import { ArrowDown, ArrowRight, ArrowUpRight, Compass, HeartHandshake, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  { icon: Search, number: '01', title: 'Tell us what happened', text: 'Share a few details about what you lost or found around campus.' },
  { icon: Compass, number: '02', title: 'Let the community help', text: 'Your campus community can keep an eye out and make a connection.' },
  { icon: HeartHandshake, number: '03', title: 'Make the way back', text: 'A little information can help someone reconnect with what matters.' },
];

export default function HomePage() {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR CAMPUS, LOOKING OUT FOR YOU</div>
        <h1>Lost something?<br />You’re in the <span className="serif-accent">right place.</span></h1>
        <p className="hero-lede">A notebook left in the library. A water bottle after practice. Let’s help the little things find their way back.</p>
        <div className="hero-actions">
          <Link to="/report/lost" className="button button-primary">Report lost item <ArrowUpRight size={16} /></Link>
          <Link to="/report/found" className="button button-secondary">Report found item</Link>
        </div>
        <div className="community-note"><div className="avatar-stack"><i>J</i><i>M</i><i>A</i><i>+</i></div><span>A community that <strong>looks out for each other</strong></span></div>
      </div>
      <div className="hero-art" aria-label="Illustration of a campus tote bag and found personal items">
        <div className="art-sun"></div><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
        <div className="art-caption"><span className="caption-dot"></span> EVERYDAY THINGS. EXTRAORDINARY KINDNESS.</div>
        <div className="bag-handle"></div><div className="bag">
          <div className="bag-stitch"></div><div className="bag-label">CAMPUS<br />&amp; CO.</div>
          <div className="notebook"><span></span><span></span><span></span><b>notes</b></div>
          <div className="bottle"><div className="bottle-cap"></div><div className="bottle-shine"></div></div>
          <div className="keyring"><div className="key-loop"></div><div className="key key-a"></div><div className="key key-b"></div><div className="key key-c"></div></div>
        </div>
        <div className="spark spark-a">✳</div><div className="spark spark-b">✦</div><div className="art-leaf leaf-a"></div><div className="art-leaf leaf-b"></div>
        <div className="floating-note"><span className="note-icon">✓</span><span><b>Small things matter</b><small>Let’s get them home.</small></span></div>
      </div>
      <a className="scroll-cue" href="#how-it-works"><ArrowDown size={14} /> A GOOD PLACE TO START</a>
    </section>
    <section className="trust-strip"><span>MADE FOR THE MOMENTS THAT MATTER</span><p>Because campus feels more like home when we look out for one another.</p><Link to="/items">See how it works <ArrowRight size={15} /></Link></section>
    <section className="steps-section" id="how-it-works"><div className="section-heading"><div><div className="eyebrow">A LITTLE HELP GOES A LONG WAY</div><h2>Good things find<br /><span className="serif-accent">their way home.</span></h2></div><p>Sometimes it takes a whole community to reunite someone with a small but important part of their day.</p></div>
      <div className="steps-grid">{steps.map(({ icon: Icon, number, title, text }) => <article className="step-card" key={number}><div className="step-top"><span>{number}</span><Icon size={21} strokeWidth={1.6} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section className="closing-card"><div><div className="eyebrow eyebrow-light">YOUR CAMPUS COMMUNITY IS HERE</div><h2>Start with what<br />you remember.</h2><p>Every detail helps bring a lost thing one step closer to its person.</p></div><Link to="/report/lost" className="button button-cream">Tell us what you lost <ArrowUpRight size={16} /></Link><div className="closing-flower">✳</div></section>
  </>;
}
