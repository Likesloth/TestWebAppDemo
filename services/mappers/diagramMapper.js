// services/mappers/diagramMapper.js

function buildGraphFromStateTests(stateTests = []) {
  const stateSet = new Set();
  stateTests.forEach(tc => {
    stateSet.add(tc.startState);
    stateSet.add(tc.expectedState);
  });
  const nodes = Array.from(stateSet).map(key => ({ key }));

  const stateValidArr = stateTests.filter(t => t.type === 'Valid');
  const links = stateValidArr.map(tc => ({
    from: tc.startState,
    to: tc.expectedState,
    text: ''
  }));

  return { nodes, links };
}

function buildSequenceDiagramFromSequences(stateSequences = []) {
  const seqNodeMap = new Map();
  const seqLinks = [];
  stateSequences.forEach(s => {
    const path = Array.isArray(s.sequence) ? s.sequence : [];
    for (let i = 0; i < path.length; i++) {
      const state = path[i];
      const key = `${s.seqCaseID}:${String(i).padStart(2, '0')}:${state}`;
      if (!seqNodeMap.has(key)) seqNodeMap.set(key, { key, label: state });
      if (i > 0) {
        const prev = path[i - 1];
        const prevKey = `${s.seqCaseID}:${String(i - 1).padStart(2, '0')}:${prev}`;
        seqLinks.push({ from: prevKey, to: key, text: '' });
      }
    }
  });
  const seqNodes = Array.from(seqNodeMap.values());
  return { seqNodes, seqLinks };
}

module.exports = {
  buildGraphFromStateTests,
  buildSequenceDiagramFromSequences
};

