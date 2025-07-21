// backend/utils/stateTestGenerator.js

/**
 * Given a known event, return the “most likely” target state.
 * Extend this map with whatever makes sense in your domain.
 */
function guessExpectedState(event) {
  const map = {
    'Put into service':       'Vacant',
    'Clean room':             'Available',
    'Take out of service':    'Final',
    'Check In':               'Occupied',
    'Check out':              'Vacant'
    // …add more event→state mappings here…
  };
  return map[event] || 'Unknown';
}

/**
 * Generate both valid and invalid state‐transition test cases
 * @param {{states: string[], events: string[], transitions: {from,event,to}[]}} param0
 * @returns {{ valid: Array, invalid: Array }}
 */
function generateStateTests({ states, events, transitions }) {
  const valid = [];
  const invalid = [];
  
  // Build a lookup of all real transitions
  const realMap = new Set(
    transitions.map(t => `${t.from}||${t.event}`)
  );

  // 1) VALID test cases: exactly as defined in XML
  let vCount = 1;
  transitions.forEach(t => {
    valid.push({
      testCaseID:    `STV${String(vCount++).padStart(3,'0')}`,
      startState:    t.from,
      event:         t.event,
      expectedState: t.to,
      type:          'Valid'
    });
  });

  // 2) INVALID test cases: every other (state,event) combo
  let iCount = 1;
  states.forEach(state => {
    events.forEach(event => {
      const key = `${state}||${event}`;
      if (!realMap.has(key)) {
        invalid.push({
          testCaseID:    `STI${String(iCount++).padStart(3,'0')}`,
          startState:    state,
          event,
          expectedState: guessExpectedState(event),  // never null now
          type:          'Invalid'
        });
      }
    });
  });

  return { valid, invalid };
}

module.exports = { generateStateTests };
