// utils/testCaseGenerator.js
const {
  processDataDictionary,
  processDecisionTree
} = require('./ecpParser');

module.exports = async function generateTestCasesLogic(dataDictionaryPath, decisionTreePath) {
  const {
    inputsMeta,      // [{ varName, type }, …]
    outputMeta,      // { varName, type }
    rangeConditions, // [{ id, varName, min, max, mid }, …]
    typeConditions,  // [{ id, varName, label }, …]
    actions          // [{ id, value }, …]
  } = await processDataDictionary(dataDictionaryPath);

  const decisions = await processDecisionTree(decisionTreePath);
  const testCases = [];

  decisions.forEach((decision, idx) => {
    const inputs   = {};
    const expected = {};
    let valid      = false;

    // CASE A: single‐level rule: <Condition .../><ACTION .../> directly under <Decision>
    if (decision.ACTION) {
      const cond = decision.Condition;
      const refid = cond.$?.refid;
      if (refid) {
        const r = rangeConditions.find(r => r.id === refid);
        const t = typeConditions .find(t => t.id === refid);
        if (r) {
          inputs[r.varName] = r.mid;
          valid = true;
        }
        if (t) {
          inputs[t.varName] = t.label;
          valid = true;
        }
      }
      const act = actions.find(a => a.id === decision.ACTION.$?.refid);
      if (act) {
        expected[ outputMeta.varName ] = act.value;
        valid = valid && true;
      }
    }
    // CASE B: nested rule: <Condition><Condition><ACTION/></Condition></Condition>
    else if (decision.Condition?.Condition) {
      const outer = decision.Condition;
      const inner = outer.Condition;
      const numRef = outer.$.refid;
      const ordRef = inner.$.refid;
      const actRef = inner.ACTION?.$?.refid;

      const r = rangeConditions.find(r => r.id === numRef);
      const t = typeConditions .find(t => t.id === ordRef);
      const a = actions        .find(a => a.id === actRef);

      if (r && t && a) {
        inputs[ r.varName ]           = r.mid;
        inputs[ t.varName ]           = t.label;
        expected[ outputMeta.varName ] = a.value;
        valid = true;
      }
    }

    if (valid) {
      testCases.push({
        testCaseID: `TC${String(idx + 1).padStart(3, '0')}`,
        inputs,
        expected
      });
    }
  });
// log data
  // console.log(
  //   "🔍 testCases from generateTestCasesLogic:",
  //   JSON.stringify(testCases, null, 2)
  // );

  return testCases;
};
