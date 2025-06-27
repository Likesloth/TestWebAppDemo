// backend/utils/ecpParser.js

const { parseXMLFile } = require('./xmlParser');

/** Midpoint helper */
function calculateMidpoint(min, max) {
  return Math.floor((Number(min) + Number(max)) / 2);
}

/**
 * Reads UseCaseDataDic.xml and returns:
 *  - inputsMeta:       [{ varName, type }]
 *  - outputMeta:       { varName, type }
 *  - rangeConditions:  [{ id, varName, min, max, mid }]
 *  - typeConditions:   [{ id, varName, label }]
 *  - actions:          [{ id, value }]
 */
async function processDataDictionary(dataDictionaryPath) {
  const data = await parseXMLFile(dataDictionaryPath);

  if (!data.UC || !data.UC.Usecase) {
    throw new Error("Invalid structure: UC/Usecase not found");
  }

  const usecase = Array.isArray(data.UC.Usecase)
    ? data.UC.Usecase[0]
    : data.UC.Usecase;

  const inputs = Array.isArray(usecase.Input)
    ? usecase.Input
    : [usecase.Input];

  const inputsMeta      = [];
  const rangeConditions = [];
  const typeConditions  = [];

  inputs.forEach(input => {
    const varName = input.Varname;
    const scale   = input.Scale;    // reading <Scale> instead of <Type>
    inputsMeta.push({ varName, type: scale });

    const conds = Array.isArray(input.Condition)
      ? input.Condition
      : (input.Condition ? [input.Condition] : []);

    if (scale === "Range") {
      conds.forEach(c => {
        const { id, min, max } = c.$;
        rangeConditions.push({
          id,
          varName,
          min: Number(min),
          max: Number(max),
          mid: calculateMidpoint(min, max)
        });
      });
    }
    else if (scale === "Nominal" || scale === "Ordinal") {
      conds.forEach(c => {
        const { id, value } = c.$;
        typeConditions.push({
          id,
          varName,
          label: value
        });
      });
    }
  });

  const output = usecase.Output;
  if (!output) {
    throw new Error("Output not found in Usecase.");
  }

  const outputMeta = {
    varName: output.Varname,
    type:    output.Scale   // reading <Scale> instead of <Type>
  };

  const rawActs = Array.isArray(output.Action)
    ? output.Action
    : [output.Action];

  const actions = rawActs.map(a => ({
    id:    a.$.id,
    value: a.$.value
  }));

  return {
    inputsMeta,
    outputMeta,
    rangeConditions,
    typeConditions,
    actions
  };
}

/** DecisionTree parser unchanged */
async function processDecisionTree(decisionTreePath) {
  const data = await parseXMLFile(decisionTreePath);
  if (!data.DecisionTree || !data.DecisionTree.DecisionS) {
    throw new Error("Invalid structure in DecisionTree XML.");
  }
  const dec = data.DecisionTree.DecisionS.Decision;
  return Array.isArray(dec) ? dec : [dec];
}

module.exports = {
  calculateMidpoint,
  processDataDictionary,
  processDecisionTree
};
