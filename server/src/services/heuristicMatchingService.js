const CATEGORY_WEIGHT = 25;
const LOCATION_WEIGHT = 20;
const DATE_WEIGHT = 25;
const TEXT_WEIGHT = 30;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'by', 'for', 'from', 'in', 'inside', 'near', 'of', 'on', 'or', 'the', 'to', 'was', 'with',
]);

function tokens(value) {
  return new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((token) => !STOP_WORDS.has(token)) || []);
}

function overlap(left, right) {
  const intersection = [...left].filter((token) => right.has(token));
  const unionSize = new Set([...left, ...right]).size;
  return { intersection, unionSize };
}

export function locationSimilarity(first, second) {
  const left = tokens(first);
  const right = tokens(second);
  const { intersection } = overlap(left, right);
  const denominator = Math.min(left.size, right.size);
  return { score: denominator ? intersection.length / denominator : 0, sharedTokens: intersection.sort() };
}

export function dateDistanceDays(first, second) {
  const parseDate = (value) => {
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
    const parsed = Date.parse(`${text}T00:00:00.000Z`);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const firstDate = parseDate(first);
  const secondDate = parseDate(second);
  return firstDate === null || secondDate === null ? null : Math.floor(Math.abs(firstDate - secondDate) / 86_400_000);
}

export function dateProximityScore(daysApart) {
  if (daysApart === null || daysApart === undefined || daysApart < 0) return 0;
  if (daysApart === 0) return 25;
  if (daysApart === 1) return 22;
  if (daysApart === 2) return 18;
  if (daysApart === 3) return 15;
  if (daysApart <= 7) return 8;
  return 0;
}

export function textSimilarity(first, second) {
  const left = tokens(`${first?.title || ''} ${first?.description || ''}`);
  const right = tokens(`${second?.title || ''} ${second?.description || ''}`);
  const { intersection, unionSize } = overlap(left, right);
  return { score: unionSize ? intersection.length / unionSize : 0, sharedTokens: intersection.sort() };
}

export function scoreHeuristic(source, candidate) {
  const sourceItemId = source?._id?.toString?.() || source?.id?.toString?.() || null;
  const candidateId = candidate?._id?.toString?.() || candidate?.id?.toString?.() || null;
  if (!source || !candidate || source.type === candidate.type || !['lost', 'found'].includes(source.type) || !['lost', 'found'].includes(candidate.type)) {
    return { eligible: false, sourceItemId, candidateId, score: 0, breakdown: { category: 0, location: 0, date: 0, text: 0 }, signals: [] };
  }

  const category = source.category === candidate.category ? CATEGORY_WEIGHT : 0;
  const locationResult = locationSimilarity(source.location, candidate.location);
  const location = Math.round(locationResult.score * LOCATION_WEIGHT);
  const daysApart = dateDistanceDays(source.date, candidate.date);
  const date = dateProximityScore(daysApart);
  const textResult = textSimilarity(source, candidate);
  const text = Math.round(textResult.score * TEXT_WEIGHT);
  const breakdown = { category, location, date, text };
  const signals = [];

  if (category) signals.push('Both reports use the same category.');
  if (locationResult.sharedTokens.length) signals.push(`Locations share: ${locationResult.sharedTokens.slice(0, 4).join(', ')}.`);
  if (daysApart !== null && daysApart <= 7) signals.push(daysApart === 0 ? 'The reported dates are the same day.' : `The reported dates are ${daysApart} day${daysApart === 1 ? '' : 's'} apart.`);
  if (textResult.sharedTokens.length) signals.push(`Descriptions share: ${textResult.sharedTokens.slice(0, 5).join(', ')}.`);

  return { eligible: true, sourceItemId, candidateId, score: Object.values(breakdown).reduce((total, value) => total + value, 0), breakdown, signals };
}

export const heuristicWeights = Object.freeze({ category: CATEGORY_WEIGHT, location: LOCATION_WEIGHT, date: DATE_WEIGHT, text: TEXT_WEIGHT });
