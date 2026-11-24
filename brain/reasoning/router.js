// Language: JavaScript (ES Modules) | File: brain/reasoning/router.js | Runtime: Node.js >= 20
// External dependency: none

/**
 * Purpose: Deterministic intent classifier for Luau engineering requests.
 * Inputs: User prompt string.
 * Outputs: Intent classification { intent, confidence, flags }.
 * Side effects: None.
 * Error modes: Coerces non-string inputs safely; defaults to 'code'.
 * Concurrency assumptions: Pure deterministic function; safe for concurrent use.
 * Performance characteristics: O(K) pattern scan over prompt text; < 0.05ms per call.
 */

const INTENT_RULES = [
  {
    intent: 'bypass',
    weight: 4,
    patterns: [
      /\bbypass\b/i,
      /\banti[\s-]?cheat\b/i,
      /\bhookmetamethod\b/i,
      /\b__namecall\b/i,
      /\bgetconnections\b/i,
      /\bgetgc\b/i,
      /\bexploit\b/i,
      /\binject\b/i,
      /\bexecutor\b/i,
    ],
  },
  {
    intent: 'debug',
    weight: 3,
    patterns: [
      /\berror\b/i,
      /\bbug\b/i,
      /\bfix\b/i,
      /\bcrash\b/i,
      /\bnil\b/i,
      /\bstack\s*trace\b/i,
      /\battempt to (index|call)\b/i,
      /\bdebug\b/i,
      /\blỗi\b/i,
      /\bsửa\b/i,
    ],
  },
  {
    intent: 'optimize',
    weight: 3,
    patterns: [
      /\boptimiz/i,
      /\bfps\b/i,
      /\blag\b/i,
      /\bmemory\s*leak\b/i,
      /\bperformance\b/i,
      /\btối\s*ưu\b/i,
      /\bmượt\b/i,
    ],
  },
  {
    intent: 'explain',
    weight: 2,
    patterns: [
      /\bexplain\b/i,
      /\bhow\s+does\b/i,
      /\bwhat\s+is\b/i,
      /\bgiải\s*thích\b/i,
      /\btại\s*sao\b/i,
      /\bcơ\s*chế\b/i,
    ],
  },
  {
    intent: 'code',
    weight: 1,
    patterns: [
      /\bwrite\b/i,
      /\bcreate\b/i,
      /\bscript\b/i,
      /\bluau\b/i,
      /\broblox\b/i,
      /\bviết\b/i,
      /\btạo\b/i,
    ],
  },
];

export function routeIntent(prompt) {
  const text = String(prompt || '').trim();
  if (!text) {
    return { intent: 'code', confidence: 0.5, flags: { requiresBypassContext: false } };
  }

  const scores = new Map();
  for (const rule of INTENT_RULES) {
    let ruleScore = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        ruleScore += rule.weight;
      }
    }
    if (ruleScore > 0) {
      scores.set(rule.intent, (scores.get(rule.intent) || 0) + ruleScore);
    }
  }

  let bestIntent = 'code';
  let bestScore = 0;
  for (const [intent, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const requiresBypassContext = (scores.get('bypass') || 0) > 0;
  const confidence = bestScore === 0 ? 0.6 : Math.min(0.99, Number((0.6 + bestScore * 0.08).toFixed(2)));

  return {
    intent: bestIntent,
    confidence,
    flags: {
      requiresBypassContext,
    },
  };
}
