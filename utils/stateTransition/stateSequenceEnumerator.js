// utils/stateTransition/stateSequenceEnumerator.js
// Purpose: Enumerate complete state sequences from the initial state using DFS,
// stopping at terminal or soft-terminal conditions.
// Exports: { enumerateStateSequences({ transitions, initialId, finalIds, ... }) }

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
  const softTerminalSet = new Set(softTerminals.map(label => label.toLowerCase()));
  const recoverySet = new Set(recoveryLabels.map(label => label.toLowerCase()));

  const isTerminal = (state, path) => {
    const lower = state.toLowerCase();
    if (finalSet.has(state)) return true;
    if (softTerminalSet.has(lower)) return true;
    const outgoingTransitions = graph.get(state) || [];
    if (!outgoingTransitions.length) return true;

    // stop when re-entering recovery
    if (path.some(visitedState => recoverySet.has(visitedState.toLowerCase()) && visitedState !== state && recoverySet.has(lower)))
      return true;

    // stop when all next transitions lead to visited states
    const pathSet = new Set(path);
    const hasNewFrontier = outgoingTransitions.some(edge => !pathSet.has(edge.to));
    return !hasNewFrontier;
  };

  const results = [];
  const seenPaths = new Set();
  let sequenceIndex = 1;

  const dfs = (state, path) => {
    if (path.length > maxDepth || isTerminal(state, path)) {
      const key = path.join('→');
      if (!seenPaths.has(key)) {
        seenPaths.add(key);
        results.push({ seqCaseID: `TC${String(sequenceIndex++).padStart(3, '0')}`, sequence: [...path] });
      }
      return;
    }
    const outgoing = graph.get(state) || [];
    for (const { to } of outgoing) {
      if (path.includes(to)) continue; // don’t revisit
      dfs(to, [...path, to]);
    }
  };

  dfs(initialId, [initialId]);
  return results;
}


module.exports = { enumerateStateSequences };
