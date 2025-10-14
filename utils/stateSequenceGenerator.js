// utils/stateSequenceGenerator.js

/**
 * Enumerate complete sequences from initial using DFS, stopping at terminals:
 * - hard terminals: any <final> id
 * - soft terminals: domain labels like Retired/Pass/Cancelled
 * - dead-end: no outgoing transitions
 * - loop-closure: all outgoing targets already in current path (no new frontier)
 */
function enumerateStateSequences({
  transitions = [],
  initialId,
  finalIds = [],
  softTerminals = ['Retired', 'Retirement', 'Pass', 'Cancelled'],
  recoveryLabels = ['Normal', 'Pass'], // states that stop expansion when re-entered
  maxDepth = 8,
  maxRepeatsPerState = 1
}) {
  const graph = new Map();
  for (const { from, to, event } of transitions) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push({ to, event });
  }

  const finalSet = new Set(finalIds);
  const softSet = new Set(softTerminals.map(s => s.toLowerCase()));
  const recoverySet = new Set(recoveryLabels.map(s => s.toLowerCase()));

  const isTerminal = (state, path) => {
    const lower = state.toLowerCase();
    if (finalSet.has(state)) return true;
    if (softSet.has(lower)) return true;
    const outs = graph.get(state) || [];
    if (!outs.length) return true;

    // stop when re-entering recovery
    if (path.some(p => recoverySet.has(p.toLowerCase()) && p !== state && recoverySet.has(lower)))
      return true;

    // stop when all next transitions lead to visited states
    const pathSet = new Set(path);
    const hasNewFrontier = outs.some(e => !pathSet.has(e.to));
    return !hasNewFrontier;
  };

  const results = [];
  const seen = new Set();
  let id = 1;

  const dfs = (state, path) => {
    if (path.length > maxDepth || isTerminal(state, path)) {
      const key = path.join('→');
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ seqCaseID: `TC${String(id++).padStart(3, '0')}`, sequence: [...path] });
      }
      return;
    }
    const outs = graph.get(state) || [];
    for (const { to } of outs) {
      if (path.includes(to)) continue; // don’t revisit
      dfs(to, [...path, to]);
    }
  };

  dfs(initialId, [initialId]);
  return results;
}


module.exports = { enumerateStateSequences };
