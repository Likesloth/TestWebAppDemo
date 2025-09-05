// backend/utils/stateMatrixGenerator.js
function buildTransitionMatrix({
  states,
  transitions,
  initial,
  finals,
  includeInitialToFinalInvalid = false
}) {
  const finalsSet = new Set(finals);

  // "from::to" -> Set(events)
  const edgeMap = new Map();
  for (const { from, to, event } of transitions) {
    const key = `${from}::${to}`;
    if (!edgeMap.has(key)) edgeMap.set(key, new Set());
    if (event) edgeMap.get(key).add(event);
  }

  const order = orderStates(states, initial, finalsSet);

  const matrix = [];
  const validCases = [];
  const invalidCases = [];
  let vc = 1, ic = 1;

  for (const from of order) {
    const row = { from, cells: [] };
    for (const to of order) {
      let kind = 'invalid';
      let id = null;

      if (to === initial) {
        kind = 'dash';
      } else if (finalsSet.has(from)) {
        kind = 'dash';
      } else if (edgeMap.has(`${from}::${to}`)) {
        kind = 'valid';
      } else if (!includeInitialToFinalInvalid && from === initial && finalsSet.has(to)) {
        kind = 'dash';
      } else {
        kind = 'invalid';
        id = `IC${String(ic++).padStart(2, '0')}`;
      }

      row.cells.push({ to, kind, id });
    }
    matrix.push(row);
  }

  for (const row of matrix) {
    for (const cell of row.cells) {
      const { to, kind, id } = cell;
      if (kind === 'valid') {
        const events = Array.from(edgeMap.get(`${row.from}::${to}`) || []);
        validCases.push({
          testCaseID: `VC${String(vc++).padStart(2, '0')}`,
          from: row.from,
          to,
          event: events.length ? events.join(' / ') : '',
          type: 'Valid'
        });
      } else if (kind === 'invalid') {
        let reason = `No direct transition defined from '${row.from}' to '${to}'.`;
        invalidCases.push({
          testCaseID: id,
          from: row.from,
          to,
          type: 'Invalid',
          reason
        });
      }
    }
  }

  return { matrix, validCases, invalidCases };
}

function orderStates(states, initial, finalsSet) {
  const mids = states.filter(s => s !== initial && !finalsSet.has(s));
  const fins = states.filter(s => finalsSet.has(s));
  return [initial, ...mids, ...fins];
}

module.exports = { buildTransitionMatrix };
