// utils/testCaseGenerator.js
const { parseXMLFile } = require('./xmlParser');

/**
 * Calculates the midpoint (representative value) for a numerical range.
 */
const calculateMidpoint = (min, max) => {
  return Math.floor((Number(min) + Number(max)) / 2);
};

/**
 * Processes the UseCaseDataDic.xml file.
 * Extracts numerical range conditions and ordinal type conditions as well as output actions.
 */
const processDataDictionary = async (dataDictionaryPath) => {
  const data = await parseXMLFile(dataDictionaryPath);
  // Expected structure: <UC><Usecase>...</Usecase></UC>
  if (!data.UC || !data.UC.Usecase) {
    throw new Error("Invalid structure: UC/Usecase not found in the data dictionary XML.");
  }
  // For simplicity, pick the first Usecase if there are multiple.
  const usecase = Array.isArray(data.UC.Usecase) ? data.UC.Usecase[0] : data.UC.Usecase;
  
  // Process Inputs
  const inputs = Array.isArray(usecase.Input) ? usecase.Input : [usecase.Input];
  let rangeConditions = []; // For Order Price ranges (Type "Range")
  let typeConditions = [];  // For CustType (Type "Ordinal")
  inputs.forEach(input => {
    if (input.Type === "Range") {
      const conds = Array.isArray(input.Condition) ? input.Condition : [input.Condition];
      rangeConditions = rangeConditions.concat(conds);
    } else if (input.Type === "Ordinal") {
      const conds = Array.isArray(input.Condition) ? input.Condition : [input.Condition];
      typeConditions = typeConditions.concat(conds);
    }
  });

  // Process Outputs: Contains the expected discount actions.
  const output = usecase.Output;
  if (!output) {
    throw new Error("Output not found in Usecase.");
  }
  const actions = Array.isArray(output.Action) ? output.Action : [output.Action];

  return { rangeConditions, typeConditions, actions };
};

/**
 * Processes the DecisionTree.xml file.
 * Extracts decision nodes from the nested structure.
 */
const processDecisionTree = async (decisionTreePath) => {
  const data = await parseXMLFile(decisionTreePath);
  // Expected structure: <DecisionTree ...><DecisionS><Decision>...</Decision></DecisionS></DecisionTree>
  if (!data.DecisionTree || !data.DecisionTree.DecisionS) {
    throw new Error("Invalid structure in DecisionTree XML.");
  }
  let decisions = data.DecisionTree.DecisionS.Decision;
  decisions = Array.isArray(decisions) ? decisions : [decisions];
  return decisions;
};

/**
 * Generates test cases based on the processed data dictionary and decision tree.
 * This mirrors the Java ECP logic by mapping refids from conditions to partitions.
 */
const generateTestCasesLogic = async (dataDictionaryPath, decisionTreePath) => {
  const { rangeConditions, typeConditions, actions } = await processDataDictionary(dataDictionaryPath);
  const decisions = await processDecisionTree(decisionTreePath);

  let testCases = [];

  decisions.forEach((decision, index) => {
    // Each Decision is structured as:
    // <Decision id="...">
    //   <Condition refid="...">  <!-- Numeric condition -->
    //      <Condition refid="..."> <!-- Ordinal condition -->
    //         <ACTION refid="..." />
    //      </Condition>
    //   </Condition>
    // </Decision>
    const outerCond = decision.Condition;
    if (!outerCond || !outerCond.$ || !outerCond.$.refid) return;
    const numericRefid = outerCond.$.refid;
    const innerCond = outerCond.Condition;
    if (!innerCond || !innerCond.$ || !innerCond.$.refid) return;
    const ordinalRefid = innerCond.$.refid;
    const actionElement = innerCond.ACTION;
    if (!actionElement || !actionElement.$ || !actionElement.$.refid) return;
    const actionRefid = actionElement.$.refid;

    // Lookup the numeric partition using refid (e.g., "1", "2", "3")
    const rangeObj = rangeConditions.find(r => r.$.id === numericRefid);
    let orderPriceValue = null;
    if (rangeObj) {
      orderPriceValue = calculateMidpoint(rangeObj.$.min, rangeObj.$.max);
    }

    // Lookup the ordinal condition (e.g., "4" or "5")
    const typeObj = typeConditions.find(t => t.$.id === ordinalRefid);
    let customerType = null;
    if (typeObj) {
      customerType = typeObj.$.value;
    }

    // Lookup expected discount from the actions in the Output
    const discountObj = actions.find(a => a.$.id === actionRefid);
    let expectedDiscount = null;
    if (discountObj) {
      expectedDiscount = discountObj.$.value;
    }

    if (orderPriceValue !== null && customerType && expectedDiscount) {
      testCases.push({
        testCaseID: `TC${(index + 1).toString().padStart(3, '0')}`,
        orderPrice: orderPriceValue,
        customerType: customerType,
        expectedDiscount: expectedDiscount
      });
    }
  });

  return testCases;
};

module.exports = { generateTestCasesLogic };
