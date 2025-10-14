// backend/utils/stateSequences.js

/**
 * Enumerate readable, non-recursive sequences starting from a hardcoded
 * 'initial' node, expanding up to three transitions deep.
 *
 * Behavior mirrors the legacy UI logic you described:
 *  - Start: path = 'initial' (lowercase, hardcoded)
 *  - Level 1..3: follow outgoing transitions depth-first
 *  - Probe Level 4 but do not append it
 *  - Filter trivial recursion:
 *      • Two-way bounce: (s2.from == s3.to && s2.to == s3.from)
 *      • One-way immediate loop: (s1.from == s2.to)
 *  - Uniqueness: do not add duplicate sequence strings
 *  - Output: array of { seqCaseID, sequence[] }
 *
 * Important: Because start is hardcoded to 'initial', XMLs that name the
 * initial state differently (e.g., 'Initial') will not produce sequences.
 *
 * @param {{
 *  transitions: { from: string, event?: string, to: string }[],
 *  initialId?: string // optional: prefer this start if it exists
 * }} params
 * @returns {{ seqCaseID: string, sequence: string[] }[]}
 */
function enumerateStateSequences({ transitions = [], initialId }) {
  // Determine a sensible START:
  // 1) Prefer provided initialId (as-is) if there are outgoing transitions
  // 2) Fallback to common variants: 'initial' (lower), 'Initial' (upper)
  // 3) If none match, keep 'initial' to mirror legacy behavior
  const hasFrom = (name) => transitions.some(t => t && t.from === name);
  const candidates = [];
  if (initialId && typeof initialId === 'string') {
    candidates.push(initialId);
    candidates.push(initialId.toLowerCase());
    // add capitalized variant
    candidates.push(initialId.charAt(0).toUpperCase() + initialId.slice(1));
  }
  candidates.push('initial');
  candidates.push('Initial');
  const START = candidates.find(c => hasFrom(c)) || 'initial';

  const results = [];
  const seen = new Set(); // sequence string uniqueness
  let counter = 1;

  const addIfNew = (pathArr) => {
    const key = pathArr.join(' → ');
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      seqCaseID: `TC${String(counter++).padStart(3, '0')}`,
      sequence: pathArr.slice()
    });
  };
  // Level 1: transitions from START
  const level1 = transitions.filter(t => t && t.from === START);
  for (const s1 of level1) {
    const p1 = [START, s1.to];
    addIfNew(p1);

    // Level 2: transitions from s1.to
    const level2 = transitions.filter(t => t && t.from === s1.to);
    for (const s2 of level2) {
      // One-way immediate loop: (s1.from == s2.to)
      if (s1.from === s2.to) continue;

      const p2 = [START, s1.to, s2.to];
      addIfNew(p2);

      // Level 3: transitions from s2.to
      const level3 = transitions.filter(t => t && t.from === s2.to);
      for (const s3 of level3) {
        // Two-way bounce: (s2.from == s3.to && s2.to == s3.from)
        if (s2.from === s3.to && s2.to === s3.from) continue;

        const p3 = [START, s1.to, s2.to, s3.to];
        addIfNew(p3);

        // Probe Level 4 (outgoing from s3.to) but do not append
        // const level4 = transitions.filter(t => t && t.from === s3.to);
      }
    }
  }

  return results;
}

module.exports = { enumerateStateSequences };
