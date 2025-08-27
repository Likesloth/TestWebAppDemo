// backend/utils/stateSequenceGenerator.js

function buildAdj(transitions) {
  const adj = new Map();
  for (const { from, to, event } of transitions) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ to, event });
  }
  return adj;
}

/**
 * Enumerate ALL prefix state sequences starting from initialId.
 * - Each sequence is an array of state names (no events).
 * - We push every prefix path encountered (Initial→A, Initial→A→B, …)
 * - Stops on dead-ends or when maxDepth reached.
 * - Avoids cycles by not revisiting a state in the same path.
 */
function enumerateStateSequences({ initialId, transitions, maxDepth = 8 }) {
  const adj = buildAdj(transitions);
  const out = [];
  let counter = 1;

  function pushSeq(seq) {
    out.push({
      seqCaseID: `SEQ${String(counter++).padStart(3, '0')}`,
      sequence: seq.slice()
    });
  }

  function dfs(path, depth) {
    if (depth >= maxDepth) return;
    const current = path[path.length - 1];
    const outs = adj.get(current) || [];

    if (outs.length === 0) return;

    for (const edge of outs) {
      const next = edge.to;
      if (path.includes(next)) continue;
      const newPath = [...path, next];

      // record every prefix
      pushSeq(newPath);

      dfs(newPath, depth + 1);
    }
  }

  dfs([initialId], 0);
  return out;
}

module.exports = { enumerateStateSequences };
