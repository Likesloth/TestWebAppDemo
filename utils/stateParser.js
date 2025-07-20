// utils/stateParser.js
const { parseXMLFile } = require('./xmlParser')

/**
 * Reads your StateMachine XML and returns { states, events, transitions }
 */
async function processStateDefs(xmlPath) {
  const data = await parseXMLFile(xmlPath)
  
  // allow both <StateMachine> and <stateMachine>
  const root = data.StateMachine || data.stateMachine
  if (!root) {
    throw new Error('Missing <StateMachine> root')
  }

  // extract initial, states, final:
  const initialNode = root.initial
  const statesArray =
    Array.isArray(root.state) ? root.state : [root.state].filter(Boolean)
  const finalNode   = root.final

  // build structures:
  const states = []
  const events = new Set()
  const transitions = []

  // initial → transitions
  if (initialNode && initialNode.transition) {
    const trans = Array.isArray(initialNode.transition)
      ? initialNode.transition
      : [initialNode.transition]
    trans.forEach(t => {
      events.add(t.$.event)
      transitions.push({
        from: initialNode.$.id,
        event: t.$.event,
        to: t.$.target
      })
    })
    states.push(initialNode.$.id)
  }

  // each <state>
  statesArray.forEach(s => {
    states.push(s.$.id)
    const trans = Array.isArray(s.transition)
      ? s.transition
      : [s.transition].filter(Boolean)
    trans.forEach(t => {
      events.add(t.$.event)
      transitions.push({
        from: s.$.id,
        event: t.$.event,
        to: t.$.target
      })
    })
  })

  // final
  if (finalNode) {
    states.push(finalNode.$.id)
  }

  return {
    states,
    events: Array.from(events),
    transitions
  }
}

module.exports = { processStateDefs }
