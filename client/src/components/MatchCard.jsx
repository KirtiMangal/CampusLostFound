import { Link } from 'react-router-dom';

const labels = { strong_candidate: 'Strong potential match', possible_candidate: 'Possible match', weak_candidate: 'Some shared details' };

export default function MatchCard({ match }) {
  const item = match.item;
  const image = item.images?.[0]?.url || (typeof item.images?.[0] === 'string' ? item.images[0] : null);
  return <article className="match-card">
    {image && <img className="match-card-image" src={image} alt="" />}
    <div className="match-card-content">
      <div className="match-card-top"><span className={`type-badge type-${item.type}`}>{item.type} item</span><span className="match-score">{match.finalScore}% match score</span></div>
      <h3><Link to={`/items/${item.id}`}>{item.title}</Link></h3>
      <p className="match-card-description">{item.description}</p>
      <p className="match-card-meta">{item.category} · {item.location} · {new Date(`${item.date}T00:00:00`).toLocaleDateString()}</p>
      <p className="match-classification">{labels[match.classification] || 'Potential match'}</p>
      {item.type === 'found' && <p className="match-card-claim-link"><Link to={`/items/${item.id}`}>View found item and submit a claim</Link></p>}
      {!!match.matchingSignals?.length && <ul>{match.matchingSignals.slice(0, 4).map((signal, index) => <li key={`${signal}-${index}`}>{signal}</li>)}</ul>}
    </div>
  </article>;
}
