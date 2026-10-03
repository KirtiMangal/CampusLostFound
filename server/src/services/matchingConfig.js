function positiveInteger(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedWeight(name, fallback) {
  const parsed = Number.parseFloat(process.env[name] || '');
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export const MATCH_CONFIG = Object.freeze({
  heuristicThreshold: positiveInteger('MATCH_HEURISTIC_THRESHOLD', 45),
  candidatePoolLimit: positiveInteger('MATCH_CANDIDATE_POOL_LIMIT', 200),
  candidateLimit: positiveInteger('MATCH_CANDIDATE_LIMIT', 10),
  heuristicWeight: boundedWeight('MATCH_HEURISTIC_WEIGHT', 0.4),
  geminiWeight: boundedWeight('MATCH_GEMINI_WEIGHT', 0.6),
  generationLimit: positiveInteger('MATCH_GENERATION_LIMIT', 5),
  generationWindowMs: positiveInteger('MATCH_GENERATION_WINDOW_MS', 15 * 60 * 1000),
});

export const MATCH_CLASSIFICATION_THRESHOLDS = Object.freeze({
  strong: positiveInteger('MATCH_STRONG_THRESHOLD', 80),
  possible: positiveInteger('MATCH_POSSIBLE_THRESHOLD', 60),
  weak: positiveInteger('MATCH_WEAK_THRESHOLD', 40),
});
