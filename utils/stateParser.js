// backend/utils/stateParser.js
const { parseXMLFile } = require('./xmlParser');

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
  const arrify = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  // collect finals first (may be multiple <final/>)
  const finalsRaw = arrify(root.final);
  const finalIds = finalsRaw
    .filter((n) => n && n.$ && n.$.id)
    .map((n) => n.$.id);

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

  // tiny helper to map target="final" -> the only final id (if exactly one exists)
  const mapTarget = (to) => {
    if (!to) return to;
    const lower = String(to).toLowerCase();
    if (finalIds.length === 1 && (lower === 'final')) {
      return finalIds[0];
    }
    return to;
    // ถ้ามีหลาย final ไม่เดาให้อัตโนมัติ เพื่อเลี่ยงผิดพลาด
  };

  // initial transitions
  if (initialNode && initialNode.transition) {
    const trans = arrify(initialNode.transition);
    trans.forEach((t) => {
      const ev = t?.$?.event;
      const to = mapTarget(t?.$?.target);
      if (ev) events.add(ev);
      transitions.push({
        from: initialId || 'Initial',
        event: ev || '',
        to: to || '',
      });
    });
  }

  // each <state>
  const statesArray = arrify(root.state);
  statesArray.forEach((s) => {
    const sid = s?.$?.id;
    if (!sid) return;
    states.push(sid);

    const trans = arrify(s.transition);
    trans.forEach((t) => {
      const ev = t?.$?.event;
      const to = mapTarget(t?.$?.target);
      if (ev) events.add(ev);
      transitions.push({
        from: sid,
        event: ev || '',
        to: to || '',
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
