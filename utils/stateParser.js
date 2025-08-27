// backend/utils/stateParser.js
const { parseXMLFile } = require('./xmlParser');

/**
 * Reads a StateMachine XML (filepath or Buffer)
 * and returns { states, events, transitions, initialId, finalId }.
 *
 * @param {string|Buffer} inputXml
 * @returns {Promise<{states:string[], events:string[], transitions:{from:string,event:string,to:string}[], initialId:string|null, finalId:string|null}>}
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
  const finalNode = root.final;

  const states = [];
  const events = new Set();
  const transitions = [];

  let initialId = null;
  let finalId   = null;

  // initial → transitions
  if (initialNode && initialNode.transition) {
    initialId = initialNode.$.id;
    states.push(initialId);

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
  }

  // each <state>
  statesArray.forEach(s => {
    if (!s || !s.$?.id) return;
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
  if (finalNode && finalNode.$?.id) {
    finalId = finalNode.$.id;
    states.push(finalId);
  }

  return {
    states,
    events: Array.from(events),
    transitions,
    initialId,
    finalId
  };
}

module.exports = { processStateDefs };
