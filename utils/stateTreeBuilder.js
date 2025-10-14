// backend/utils/stateTreeBuilder.js

/**
 * Build a tree-like unfolding of a state machine graph.
 * - Duplicates node per occurrence (no reuse), unique keys per position
 * - Labels links with events
 * - Stops at finals or maxDepth
 * - Optional trivial bounce filter (A->B->A)
 *
 * @param {{
 *  transitions: { from: string, event?: string, to: string }[],
 *  initialId?: string,
 *  finalIds?: string[],
 *  maxDepth?: number,
 *  filterBounce?: boolean
 * }} params
 * @returns {{ nodes: { key: string, label: string }[], links: { from: string, to: string, text: string }[] }}
 */
function buildStateTree({
  transitions = [],
  initialId,
  finalIds = [],
  maxDepth = 8,
  filterBounce = true
}) {
  // Determine a practical start name by checking which name actually has outgoing transitions
  const hasFrom = (name) => transitions.some(t => t && t.from === name);
  const startCandidates = [];
  if (initialId && typeof initialId === 'string') {
    startCandidates.push(initialId, initialId.toLowerCase(), initialId.charAt(0).toUpperCase() + initialId.slice(1));
  }
  startCandidates.push('initial', 'Initial');
  const start = startCandidates.find(c => hasFrom(c)) || (initialId || 'initial');

  const finals = new Set(finalIds || []);

  // adjacency by from
  const graph = new Map();
  for (const t of transitions) {
    if (!t || typeof t.from !== 'string') continue;
    if (!graph.has(t.from)) graph.set(t.from, []);
    graph.get(t.from).push({ from: t.from, to: t.to, event: t.event || '' });
  }

  const nodes = [];
  const links = [];
  let counter = 0; // monotonically increasing to stabilize keys

  const makeKey = (depth, state) => `TREE:${String(counter++).padStart(4, '0')}:${String(depth).padStart(2, '0')}:${state}`;

  // DFS stack frames include the parent state label and its key for link building
  function dfs(state, depth, parentKey, parentLabel, lastStateLabel, incomingEvent) {
    const key = makeKey(depth, state);
    nodes.push({ key, label: state });

    if (parentKey) {
      links.push({ from: parentKey, to: key, text: incomingEvent || '' });
    }

    if (finals.has(state) || depth >= maxDepth) return;

    const outs = graph.get(state) || [];
    // sort by event/text to provide stable ordering
    outs.sort((a, b) => String(a.event).localeCompare(String(b.event)) || String(a.to).localeCompare(String(b.to)));

    for (const tr of outs) {
      if (filterBounce && lastStateLabel && tr.to === lastStateLabel) {
        // skip trivial bounce A->B->A
        continue;
      }
      dfs(tr.to, depth + 1, key, state, parentLabel || null, tr.event || '');
    }
  }

  // create root at depth 0 (no parent link)
  dfs(start, 0, null, null, null, '');

  return { nodes, links };
}

module.exports = { buildStateTree };
