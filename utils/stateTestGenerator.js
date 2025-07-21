// backend/utils/stateTestGenerator.js

/**
 * Generate both valid and invalid state‐transition test cases,
 * ensuring every invalid case gets a meaningful expectedState
 * by mapping events to target states regardless of startState.
 *
 * @param {{states: string[], events: string[], transitions: {from,event,to}[]}} param0
 * @returns {{ valid: Array, invalid: Array }}
 */
function generateStateTests({ states, events, transitions }) {
  // 1) Build maps:
  //    • transitionMap: for exact valid transitions
  //    • eventToTargetMap: for any occurrence of an event → target
  const transitionMap   = {};
  const eventToTargetMap = {};

  transitions.forEach(({ from, event, to }) => {
    // exact match
    transitionMap[`${from}::${event}`] = to;

    // general event→target (first seen wins)
    if (!eventToTargetMap[event]) {
      eventToTargetMap[event] = to;
    }
  });

  const valid = [];
  const invalid = [];

  // 2) VALID test cases
  let vCount = 1;
  transitions.forEach(({ from, event, to }) => {
    valid.push({
      testCaseID:    `STV${String(vCount++).padStart(3, '0')}`,
      startState:    from,
      event,
      expectedState: to,
      type:          'Valid'
    });
  });

  // 3) INVALID test cases: any (state,event) not in transitionMap
  let iCount = 1;
  states.forEach(state => {
    events.forEach(event => {
      const key = `${state}::${event}`;
      if (!transitionMap[key]) {
        invalid.push({
          testCaseID:    `STI${String(iCount++).padStart(3, '0')}`,
          startState:    state,
          event,
          // lookup in the broader event→target map
          expectedState: eventToTargetMap[event] || 'Unknown',
          type:          'Invalid'
        });
      }
    });
  });

  return { valid, invalid };
}

module.exports = { generateStateTests };
