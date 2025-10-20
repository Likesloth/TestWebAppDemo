// backend/utils/stateTransition/stateMachineXmlParser.js
// Purpose: Parse a state machine XML into plain structures used by the
// state utilities and service layer.
// Exports: { processStateDefs(inputXml) }
// Returns: { initialId, finalIds, states, events, transitions }
// - transitions: Array<{ from, event, to }>
const { parseXMLFile } = require('../xmlParser');

/**
 * Reads a StateMachine XML (filepath or Buffer)
 * and returns { initialId, finalIds, states, events, transitions }.
 *
 * @param {string|Buffer} inputXml
 * @returns {Promise<{
 *  initialId: string|null,
 *  finalIds: string[],
 *  states: string[],
 *  events: string[],
 *  transitions: { from: string, event: string, to: string }[]
 * }>}
 */
async function processStateDefs(inputXml) {
  const data = await parseXMLFile(inputXml);

  // allow both <StateMachine> and <stateMachine>
  const root = data.StateMachine || data.stateMachine;
  if (!root) {
    throw new Error('Missing <StateMachine> root');
  }

  // normalize helpers
  const arrify = (value) => (Array.isArray(value) ? value : value ? [value] : []);

  // collect finals first (may be multiple <final/>)
  const finalsRaw = arrify(root.final);
  const finalIds = finalsRaw
    .filter((finalNode) => finalNode && finalNode.$ && finalNode.$.id)
    .map((finalNode) => finalNode.$.id);

  const states = [];
  const events = new Set();
  const transitions = [];

  // initial (can have transitions)
  const initialNode = root.initial;
  let initialId = null;

  // If initial has an id, record it; otherwise keep null
  if (initialNode && initialNode.$ && initialNode.$.id) {
    initialId = initialNode.$.id;
    states.push(initialId);
  }

  // map target="final" -> the only final id (if exactly one exists)
  const mapTarget = (to) => {
    if (!to) return to;
    const lower = String(to).toLowerCase();
    if (finalIds.length === 1 && lower === 'final') {
      return finalIds[0];
    }
    return to;
    // ถ้ามีหลาย final ไม่เดาให้อัตโนมัติ เพื่อเลี่ยงผิดพลาด
  };

  // initial transitions
  if (initialNode && initialNode.transition) {
    const initialTransitions = arrify(initialNode.transition);
    initialTransitions.forEach((transitionNode) => {
      const eventName = transitionNode?.$?.event;
      const targetId = mapTarget(transitionNode?.$?.target);
      if (eventName) events.add(eventName);
      transitions.push({
        from: initialId || 'Initial',
        event: eventName || '',
        to: targetId || '',
      });
    });
  }

  // each <state>
  const statesArray = arrify(root.state);
  statesArray.forEach((stateNode) => {
    const stateId = stateNode?.$?.id;
    if (!stateId) return;
    states.push(stateId);

    const stateTransitions = arrify(stateNode.transition);
    stateTransitions.forEach((transitionNode) => {
      const eventName = transitionNode?.$?.event;
      const targetId = mapTarget(transitionNode?.$?.target);
      if (eventName) events.add(eventName);
      transitions.push({
        from: stateId,
        event: eventName || '',
        to: targetId || '',
      });
    });
  });

  // add final ids into states list as well
  finalIds.forEach((fid) => states.push(fid));

  // dedupe states
  const statesUnique = Array.from(new Set(states));

  return {
    initialId,
    finalIds,
    states: statesUnique,
    events: Array.from(events),
    transitions,
  };
}

module.exports = { processStateDefs };
