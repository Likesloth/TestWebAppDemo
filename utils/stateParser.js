// backend/utils/stateParser.js
const { parseXMLFile } = require('./xmlParser');

/**
 * Reads a StateMachine XML (filepath or Buffer)
 * and returns { states, events, transitions }.
 *
 * @param {string|Buffer} inputXml
 * @returns {Promise<{states:string[], events:string[], transitions:{from:string,event:string,to:string}[]}>}
 */
async function processStateDefs(inputXml) {
  const data = await parseXMLFile(inputXml);

  // allow both <StateMachine> and <stateMachine>
  const root = data.StateMachine || data.stateMachine;
  if (!root) {
    throw new Error('Missing <StateMachine> root');
  }

  const initialNode = root.initial;
  const statesArray = Array.isArray(root.state)
    ? root.state
    : root.state
      ? [root.state]
      : [];
  const finalNode   = root.final;

  const states = [];
  const events = new Set();
  const transitions = [];

  // initial → transitions
  if (initialNode && initialNode.transition) {
    const trans = Array.isArray(initialNode.transition)
      ? initialNode.transition
      : [initialNode.transition];
    trans.forEach(t => {
      events.add(t.$.event);
      transitions.push({
        from: initialNode.$.id,
        event: t.$.event,
        to: t.$.target
      });
    });
    states.push(initialNode.$.id);
  }

  // each <state>
  statesArray.forEach(s => {
    states.push(s.$.id);
    const trans = Array.isArray(s.transition)
      ? s.transition
      : s.transition
        ? [s.transition]
        : [];
    trans.forEach(t => {
      events.add(t.$.event);
      transitions.push({
        from: s.$.id,
        event: t.$.event,
        to: t.$.target
      });
    });
  });

  // final state (no outgoing transitions)
  if (finalNode && finalNode.$) {
    states.push(finalNode.$.id);
  }

  return {
    states,
    events: Array.from(events),
    transitions
  };
}

module.exports = { processStateDefs };
