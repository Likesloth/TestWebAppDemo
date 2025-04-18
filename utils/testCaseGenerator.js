const {
  processDataDictionary,
  processDecisionTree
} = require('./dataParser');

module.exports = async function generateTestCasesLogic(dataDictionaryPath, decisionTreePath) {
  const { rangeConditions, typeConditions, actions } =
    await processDataDictionary(dataDictionaryPath);
  const decisions =
    await processDecisionTree(decisionTreePath);

  const testCases = [];

  decisions.forEach((decision, idx) => {
    const outer = decision.Condition;
    if (!outer?.$?.refid) return;
    const numericRefid = outer.$.refid;

    const inner = outer.Condition;
    if (!inner?.$?.refid) return;
    const ordinalRefid = inner.$.refid;

    const actionEl = inner.ACTION;
    if (!actionEl?.$?.refid) return;
    const actionRefid = actionEl.$.refid;

    const rangeObj = rangeConditions.find(r => r.id === numericRefid);
    const typeObj  = typeConditions.find(t => t.id === ordinalRefid);
    const discObj  = actions.find(a => a.id === actionRefid);

    if (rangeObj && typeObj && discObj) {
      testCases.push({
        testCaseID:       `TC${(idx + 1).toString().padStart(3, '0')}`,
        orderPrice:       rangeObj.mid,
        customerType:     typeObj.label,
        expectedDiscount: discObj.value
      });
    }
  });

  return testCases;
};
