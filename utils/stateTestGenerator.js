// backend/utils/stateTestGenerator.js

/**
 * Generate both valid and invalid state‐transition test cases,
 * with filters to drop some invalid cases:
 *  - Drop all from Final -> *
 *  - Drop Initial -> Final for any event that ever leads to a final (from any state)
 *
 * @param {{
 *   states: string[],
 *   events: string[],
 *   transitions: { from:string, event:string, to:string }[],
 *   initialStates?: string[],
 *   finalStates?: string[]
 * }} args
 * @returns {{ valid: Array, invalid: Array }}
 */
function generateStateTests({ states, events, transitions, initialStates = [], finalStates = [] }) {
  const norm = (s) => String(s || '').trim();

  const nInitials = new Set(initialStates.map(norm));
  const nFinals   = new Set(finalStates.map(norm));

  // maps:
  //  - transitionMap: exact valid transitions "from::event" -> to
  //  - eventToTargets: event -> Set(to) (for inferring expected in invalid)
  //  - eventsThatLeadToFinal: events that (anywhere) lead to a final state
  const transitionMap = new Map();
  const eventToTargets = new Map();
  const eventsThatLeadToFinal = new Set();

  for (const t of transitions) {
    const from = norm(t.from);
    const to   = norm(t.to);
    const ev   = norm(t.event);

    transitionMap.set(`${from}::${ev}`, to);

    if (!eventToTargets.has(ev)) eventToTargets.set(ev, new Set());
    eventToTargets.get(ev).add(to);

    if (nFinals.has(to)) eventsThatLeadToFinal.add(ev);
  }

  // valid: all transitions as-is
  const valid = [];
  let vCount = 1;
  for (const { from, event, to } of transitions) {
    valid.push({
      testCaseID: `TC${String(vCount++).padStart(3, '0')}`,
      startState: norm(from),
      event:      norm(event),
      expectedState: norm(to),
      type: 'Valid'
    });
  }

  // invalid: cross states × events minus valid + filters
  const invalid = [];
  let iCount = 1;

  for (const rawS of states) {
    const s = norm(rawS);

    for (const rawE of events) {
      const e = norm(rawE);
      const key = `${s}::${e}`;

      // already valid
      if (transitionMap.has(key)) continue;

      // FILTER #1: from Final -> anything
      if (nFinals.has(s)) continue;

      // FILTER #2: from Initial with event that can lead to Final (somewhere)
      if (nInitials.has(s) && eventsThatLeadToFinal.has(e)) continue;

      // infer expectedState
      const targets = Array.from(eventToTargets.get(e) || []);
      let expectedState = 'Unknown';
      if (targets.length === 1) {
        expectedState = targets[0];
      } else if (targets.length > 1) {
        expectedState = targets.join(' | ');
      }

      invalid.push({
        testCaseID: `TC${String(iCount++).padStart(3, '0')}`,
        startState: s,
        event: e,
        expectedState,
        type: 'Invalid',
        reason: `No transition defined from '${s}' with '${e}'`
      });
    }
  }

  return { valid, invalid };
}

module.exports = { generateStateTests };
