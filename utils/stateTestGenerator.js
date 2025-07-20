// backend/utils/stateTestGenerator.js
/**
 * Given { states, events, transitions }, returns
 *  - valid:   all transitions in XML
 *  - invalid: every (state × event) pair not in transitions
 */
function generateStateTests({ states, events, transitions }) {
    // valid cases
    const valid = transitions.map((t,i) => ({
      testCaseID:   `STV${String(i+1).padStart(3,'0')}`,
      startState:   t.from,
      event:        t.event,
      expectedState:t.to,
      type:         'Valid'
    }))
  
    // invalid cases
    const invalid = []
    states.forEach(s => {
      events.forEach(e => {
        const ok = transitions.some(t => t.from===s.id && t.event===e.id)
        if (!ok) {
          invalid.push({
            testCaseID:   `STI${String(invalid.length+1).padStart(3,'0')}`,
            startState:   s.id,
            event:        e.id,
            expectedState:null,
            type:         'Invalid'
          })
        }
      })
    })
  
    return { valid, invalid }
  }
  
  module.exports = { generateStateTests }
  