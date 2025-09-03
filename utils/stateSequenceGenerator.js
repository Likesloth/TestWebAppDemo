// backend/utils/stateSequences.js

/**
 * Enumerate ONLY "complete" state sequences from a state graph.
 * A sequence is considered complete when:
 *  - it reaches any state listed in `finalIds`, OR
 *  - it cannot continue (dead end, i.e., no valid next states left).
 *
 * Notes:
 *  - We DO NOT record intermediate prefixes that can still continue.
 *  - To avoid infinite loops, we (a) cap path length with `maxDepth`,
 *    and (b) limit how many times the same state can be revisited
 *    in a single path with `maxRepeatsPerState`.
 *  - When `maxDepth` is reached, we treat the path as terminal to prevent runaway loops.
 *
 * @param {{
 *  initialId: string,
 *  transitions: { from: string, event?: string, to: string }[],
 *  finalIds: string[],
 *  maxDepth?: number,              // default 8
 *  maxRepeatsPerState?: number,    // default 2
 * }} params
 * @returns {{ seqCaseID: string, sequence: string[] }[]}
 */
function enumerateStateSequences({
  initialId,
  transitions,
  finalIds,
  maxDepth = 8,
  maxRepeatsPerState = 2,
}) {
  if (!initialId) return [];

  // Build adjacency list: state -> array of neighbor states (events are not needed here)
  const graph = new Map();
  for (const { from, to } of transitions) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push(to);
  }

  const finalSet = new Set(finalIds || []);
  const results = [];
  const seenSeq = new Set(); // avoid duplicate sequences (e.g., different events leading to same state chain)
  let seqCounter = 1;

  const pushResult = (path /*, reason */) => {
    const key = path.join('→');
    if (seenSeq.has(key)) return;
    seenSeq.add(key);

    results.push({
      seqCaseID: `TC${String(seqCounter++).padStart(3, '0')}`,
      sequence: path.slice(),
      // If you want to expose why a path terminated, include `reason` above.
    });
  };

  const dfs = (current, path, visitCount, depth) => {
    // Terminate if we reached a final state
    if (finalSet.has(current)) {
      pushResult(path /*, 'final' */);
      return;
    }

    // Valid neighbors that still satisfy the repeat limit
    const neighbors = graph.get(current) || [];
    const frontier = neighbors.filter(
      (n) => (visitCount.get(n) || 0) < maxRepeatsPerState
    );

    // Dead end = no valid neighbors to continue
    if (frontier.length === 0) {
      pushResult(path /*, 'dead-end' */);
      return;
    }

    // Safety guard: consider maxDepth a terminal condition to prevent runaway loops
    if (depth >= maxDepth) {
      pushResult(path /*, 'maxDepth' */);
      return;
    }

    // Continue DFS on all valid neighbors
    for (const nxt of frontier) {
      path.push(nxt);
      visitCount.set(nxt, (visitCount.get(nxt) || 0) + 1);

      dfs(nxt, path, visitCount, depth + 1);

      // backtrack
      visitCount.set(nxt, visitCount.get(nxt) - 1);
      path.pop();
    }
  };

  const visitCount = new Map([[initialId, 1]]);
  dfs(initialId, [initialId], visitCount, 0);

  return results;
}

module.exports = { enumerateStateSequences };
