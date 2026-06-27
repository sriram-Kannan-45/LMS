// Pure-JS plagiarism detection — Jaccard similarity on code token bigrams.
// No external dependencies.

// Strip // line comments and /* */ block comments and # (python) comments.
function stripComments(code) {
  return (code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ');
}

function tokenize(code) {
  return stripComments(code)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

function bigrams(tokens) {
  const set = new Set();
  for (let i = 0; i < tokens.length - 1; i++) set.add(tokens[i] + ' ' + tokens[i + 1]);
  return set;
}

function flagFor(score) {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'NONE';
}

/**
 * Returns { score (0-100, rounded 1dp), flag } for two source strings.
 */
function compareCode(codeA, codeB) {
  const a = bigrams(tokenize(codeA));
  const b = bigrams(tokenize(codeB));
  if (a.size === 0 && b.size === 0) return { score: 0, flag: 'NONE' };

  let intersection = 0;
  for (const g of a) if (b.has(g)) intersection++;
  const union = a.size + b.size - intersection;
  const score = union === 0 ? 0 : Math.round((intersection / union) * 1000) / 10;
  return { score, flag: flagFor(score) };
}

module.exports = { tokenize, compareCode, flagFor };
