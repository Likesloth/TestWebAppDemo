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

  // Only consider inputs that actually participate in ECP via <Condition>
  const ecpRangeVars = new Set(rangeConditions.map(r => r.varName));
  const ecpNomVars   = new Set(typeConditions.map(t => t.varName));
  const ecpVarSet    = new Set([...ecpRangeVars, ...ecpNomVars]);

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
        type: 'Valid',
        inputs,
        expected
      });
    }
  });
  
  // --- Add invalid/out-of-range partition cases (ECP negative tests) ---
  // Build a typical (baseline) input map (only for vars that have <Condition>)
  const baselineInputs = {};
  for (const { varName, type } of inputsMeta.filter(i => ecpVarSet.has(i.varName))) {
    if (type === 'Range') {
      // choose the mid of the smallest-range bucket for determinism
      const buckets = rangeConditions
        .filter(r => r.varName === varName)
        .sort((a, b) => a.min - b.min);
      baselineInputs[varName] = buckets.length ? buckets[0].mid : null;
    } else if (type === 'Nominal' || type === 'Ordinal') {
      const cats = typeConditions.filter(t => t.varName === varName);
      baselineInputs[varName] = cats.length ? cats[0].label : null;
    } else {
      baselineInputs[varName] = null;
    }
  }
  
  // Helper to clone baseline then override
  function withOverride(name, value) {
    const obj = { ...baselineInputs };
    obj[name] = value;
    return obj;
  }
  
  // Determine next ID index
  let nextIndex = testCases.length + 1;
  const outVar = outputMeta?.varName;
  const mkExpected = (varName) => (outVar ? { [outVar]: `Invalid ${varName}` } : {});
  
  // Generate invalid cases per input (only those with <Condition>)
  for (const { varName, type } of inputsMeta.filter(i => ecpVarSet.has(i.varName))) {
    if (type === 'Range') {
      const ranges = rangeConditions
        .filter(r => r.varName === varName)
        .sort((a, b) => a.min - b.min);
      if (ranges.length) {
        const globalMin = ranges[0].min;
        const globalMax = ranges[ranges.length - 1].max;
        const underflow = Number.isFinite(globalMin) ? globalMin - 1 : null;
        const overflow  = Number.isFinite(globalMax) ? globalMax + 1 : null;
        if (underflow !== null) {
          testCases.push({
            testCaseID: `TC${String(nextIndex++).padStart(3, '0')}`,
            type: 'Invalid',
            inputs: withOverride(varName, underflow),
            expected: mkExpected(varName)
          });
        }
        if (overflow !== null) {
          testCases.push({
            testCaseID: `TC${String(nextIndex++).padStart(3, '0')}`,
            type: 'Invalid',
            inputs: withOverride(varName, overflow),
            expected: mkExpected(varName)
          });
        }
      }
    } else if (type === 'Nominal' || type === 'Ordinal') {
      // Only include the None/null invalid case for variables that have categories
      const cats = typeConditions.filter(t => t.varName === varName);
      if (!cats.length) continue;
      testCases.push({
        testCaseID: `TC${String(nextIndex++).padStart(3, '0')}`,
        type: 'Invalid',
        inputs: withOverride(varName, null),
        expected: mkExpected(varName)
      });
    }
  }

  return testCases;
};
