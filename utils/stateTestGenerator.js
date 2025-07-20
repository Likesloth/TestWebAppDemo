// backend/utils/stateTestGenerator.js
/**
 * Takes:
 *  - states:      [ "Initial", "Vacant", … ]
 *  - events:      [ "Put into service", "Clean room", … ]
 *  - transitions: [ { from, event, to }, … ]
 *
 * Returns:
 *  - valid:   [ { testCaseID, startState, event, expectedState, type:"Valid" }, … ]
 *  - invalid: [ { testCaseID, startState, event, expectedState:null, type:"Invalid" }, … ]
 */
function generateStateTests({ states, events, transitions }) {
    // 1) build valid tests
    const valid = transitions.map((t, i) => ({
      testCaseID:    `STV${String(i + 1).padStart(3, '0')}`,
      startState:    t.from,
      event:         t.event,
      expectedState: t.to,
      type:          'Valid'
    }));
  
    // 2) build invalid tests: any (state, event) combo NOT in transitions
    const invalid = [];
    let idx = 1;
    states.forEach(s => {
      events.forEach(e => {
        const has = transitions.some(t => t.from === s && t.event === e);
        if (!has) {
          invalid.push({
            testCaseID:    `STI${String(idx++).padStart(3, '0')}`,
            startState:    s,
            event:         e,
            expectedState: null,
            type:          'Invalid'
          });
        }
      });
    });
  
    return { valid, invalid };
  }
  
  module.exports = { generateStateTests };
  