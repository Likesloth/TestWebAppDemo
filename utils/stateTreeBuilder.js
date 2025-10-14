/**
 * Build a tree-like unfolding of a state machine graph.
 * - Duplicates node per occurrence (no reuse), unique keys per position
 * - Labels links with events
 * - Stops at finals or maxDepth
 * - Optional trivial bounce filter (A->B->A)
 */
function buildStateTree({
  transitions = [],
  initialId,
  finalIds = [],
  maxDepth = 8,
  filterBounce = true,
  maxRepeatsPerState = 2,
  appendDuplicateIndex = true,
  treatRetiredAsTerminal = true,
  recoveryLabels = ['Normal', 'Pass'],
  stopOnRecoveryReentry = true,
  expandOnceGlobally = true,
  stopLabelsOnSide = ['First Pro']
}) {
  // --- determine start node
  const hasFrom = (name) => transitions.some(t => t && t.from === name);
  const startCandidates = [];
  if (initialId && typeof initialId === 'string') {
    startCandidates.push(initialId, initialId.toLowerCase(), initialId.charAt(0).toUpperCase() + initialId.slice(1));
  }
  startCandidates.push('initial', 'Initial');
  const start = startCandidates.find(c => hasFrom(c)) || (initialId || 'initial');

  const finals = new Set(finalIds || []);

  // --- adjacency map
  const graph = new Map();
  for (const t of transitions) {
    if (!t || typeof t.from !== 'string') continue;
    if (!graph.has(t.from)) graph.set(t.from, []);
    graph.get(t.from).push({ from: t.from, to: t.to, event: t.event || '' });
  }

  const nodes = [];
  const links = [];
  let counter = 0;
  const expandedOnce = new Set();

  const makeKey = (depth, baseLabel, dupIndex) => {
    const suffix = appendDuplicateIndex && dupIndex > 1 ? `_${dupIndex}` : '';
    return `TREE:${String(counter++).padStart(4, '0')}:${String(depth).padStart(2, '0')}:${baseLabel}${suffix}`;
  };

  const isTerminal = (label) => {
    const l = String(label).toLowerCase();
    if (finals.has(label)) return true;
    if (l === 'final') return true;
    if (treatRetiredAsTerminal && l === 'retired') return true;
    return false;
  };

  /**
   * DFS traversal with path-aware recovery context
   */
  function dfs(
    state,
    depth,
    parentKey,
    parentLabel,
    lastStateLabel,
    incomingEvent,
    visitCountMap,
    pathLabels,
    inRecoveryBranch // boolean: true after first recovery label in this path
  ) {
    const baseLabel = state;
    const baseLower = String(baseLabel).toLowerCase();

    const currentCount = (visitCountMap.get(baseLabel) || 0) + 1;
    const newVisit = new Map(visitCountMap);
    newVisit.set(baseLabel, currentCount);

    const key = makeKey(depth, baseLabel, currentCount);
    nodes.push({ key, label: baseLabel });
    if (parentKey) links.push({ from: parentKey, to: key, text: incomingEvent || '' });

    // --- stop at terminal/depth
    if (isTerminal(baseLabel) || depth >= maxDepth) return;

    const recoverySet = new Set((recoveryLabels || []).map(x => String(x).toLowerCase()));
    const stopSideSet = new Set((stopLabelsOnSide || []).map(x => String(x).toLowerCase()));

    // stop if recovery reentry on same path
    if (stopOnRecoveryReentry && recoverySet.has(baseLower) && pathLabels.includes(baseLabel)) return;

    // Determine if we're in the recovery branch: once true, stays true down this subtree
    const isRecoveryNode = recoverySet.has(baseLower);
    const newInRecoveryBranch = inRecoveryBranch || isRecoveryNode;

    // Side stop: if inside recovery branch, parent is NOT recovery, and current label is a stop label (e.g., First Pro), stop here
    const parentIsRecovery = recoverySet.has(String(parentLabel || '').toLowerCase());
    if (newInRecoveryBranch && !parentIsRecovery && stopSideSet.has(baseLower)) return;

    const outs = graph.get(baseLabel) || [];

    // --- Global expand-once (context-aware)
    if (expandOnceGlobally) {
      const contextKey = `${baseLower}::${newInRecoveryBranch ? 'main' : 'side'}`;
      if (expandedOnce.has(contextKey)) return;
      if (outs.length) expandedOnce.add(contextKey);
    }

    // --- Sort transitions for stable layout
    outs.sort(
      (a, b) =>
        String(a.event).localeCompare(String(b.event)) ||
        String(a.to).localeCompare(String(b.to))
    );

    for (const tr of outs) {
      // Only skip immediate back-edge to the direct parent (A -> B -> A),
      // BUT allow it when bouncing back to a recovery label (e.g., Normal/Pass)
      if (filterBounce && parentLabel && tr.to === parentLabel) {
        const toLower = String(tr.to).toLowerCase();
        if (!recoverySet.has(toLower)) continue;
      }

      const nextBase = tr.to;
      const nextCount = (newVisit.get(nextBase) || 0) + 1;
      if (nextCount > maxRepeatsPerState) {
        const nextKey = makeKey(depth + 1, nextBase, nextCount);
        nodes.push({ key: nextKey, label: nextBase });
        links.push({ from: key, to: nextKey, text: tr.event || '' });
        continue;
      }

      const nextPath = [...(pathLabels || []), baseLabel];
      dfs(
        nextBase,
        depth + 1,
        key,
        baseLabel,
        parentLabel || null,
        tr.event || '',
        newVisit,
        nextPath,
        newInRecoveryBranch
      );
    }
  }

  dfs(start, 0, null, null, null, '', new Map(), [], false);

  return { nodes, links };
}

module.exports = { buildStateTree };
