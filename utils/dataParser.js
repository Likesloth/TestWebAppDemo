const { parseXMLFile } = require('./xmlParser');

/** Midpoint helper */
function calculateMidpoint(min, max) {
  return Math.floor((Number(min) + Number(max)) / 2);
}

/**
 * Reads UseCaseDataDic.xml and returns:
 *  - inputsMeta:    [{ type, varName }, …]
 *  - outputMeta:    { type, varName }
 *  - rangeConditions, typeConditions, actions
 */
async function processDataDictionary(dataDictionaryPath) {
  const data = await parseXMLFile(dataDictionaryPath);
  if (!data.UC || !data.UC.Usecase) {
    throw new Error("Invalid structure: UC/Usecase not found");
  }
  const usecase = Array.isArray(data.UC.Usecase)
    ? data.UC.Usecase[0]
    : data.UC.Usecase;

  // Capture input metadata
  const inputs = Array.isArray(usecase.Input)
    ? usecase.Input
    : [usecase.Input];

  const inputsMeta = inputs.map(input => ({
    type:    input.Type,      // "Range" or "Ordinal"
    varName: input.Varname    // e.g. "Order Price"
  }));

  // Extract conditions
  const rangeConditions = [];
  const typeConditions  = [];

  inputs.forEach(input => {
    const conds = Array.isArray(input.Condition)
      ? input.Condition
      : [input.Condition];

    if (input.Type === "Range") {
      conds.forEach(c => {
        rangeConditions.push({
          id:  c.$.id,
          min: Number(c.$.min),
          max: Number(c.$.max),
          mid: calculateMidpoint(c.$.min, c.$.max)
        });
      });
    } else if (input.Type === "Ordinal") {
      conds.forEach(c => {
        typeConditions.push({
          id:    c.$.id,
          label: c.$.value
        });
      });
    }
  });

  // Capture output metadata and actions
  const output = usecase.Output;
  if (!output) throw new Error("Output not found in Usecase.");

  const outputMeta = {
    type:    output.Type,      // e.g. "Ordinal"
    varName: output.Varname    // e.g. "Total Discount"
  };

  const rawActions = Array.isArray(output.Action)
    ? output.Action
    : [output.Action];
  const actions = rawActions.map(a => ({
    id:    a.$.id,
    value: a.$.value
  }));

  // // log to see the data array format
  // console.log("=== processDataDictionary outputs ===");
  // console.log("inputsMeta:", JSON.stringify(inputsMeta, null, 2));
  // console.log("outputMeta:", JSON.stringify(outputMeta, null, 2));
  // console.log("rangeConditions:", JSON.stringify(rangeConditions, null, 2));
  // console.log("typeConditions:", JSON.stringify(typeConditions, null, 2));
  // console.log("actions:", JSON.stringify(actions, null, 2));
  // console.log("======================================");

  return {
    inputsMeta,
    outputMeta,
    rangeConditions,
    typeConditions,
    actions
  };

}

/** Reads DecisionTree.xml and returns an array of <Decision> nodes */
async function processDecisionTree(decisionTreePath) {
  const data = await parseXMLFile(decisionTreePath);

  // 1) Log the entire parsed XML → JS object
  // console.log("=== raw DecisionTree data ===");
  // console.log(JSON.stringify(data, null, 2)); //Raw data

  if (!data.DecisionTree || !data.DecisionTree.DecisionS) {
    throw new Error("Invalid structure in DecisionTree XML.");
  }

  // 2) Extract the <Decision> node(s)
  const dec = data.DecisionTree.DecisionS.Decision;

  // 3) Log the extracted decision nodes
  // console.log("=== extracted Decision nodes ===");
  // console.log(JSON.stringify(dec, null, 2)); //extract data

  // 4) Return as array
  return Array.isArray(dec) ? dec : [dec];
}


module.exports = {
    calculateMidpoint,
    processDataDictionary,
    processDecisionTree
  };