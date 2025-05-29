// backend/controllers/testGenController.js
const { stringify }               = require('csv-stringify/sync');
const generatePartitions          = require('../utils/partitionGenerator');
const generateTestCasesLogic      = require('../utils/testCaseGenerator');
const { processDataDictionary, processDecisionTree } = require('../utils/ecpParser');
const { processSyntaxDefs }       = require('../utils/syntaxParser');
const { generateSyntaxTests }     = require('../utils/syntaxTestGenerator');

module.exports.generateAll = async (ddPath, dtPath) => {
  // ─── ECP ─────────────────────────────────────────────────────
  const partitions = await generatePartitions(ddPath);
  const testCases  = await generateTestCasesLogic(ddPath, dtPath);
  if (!testCases.length) throw new Error('No ECP test cases generated');

  // Build in-memory CSV for the ECP testCases
  const first        = testCases[0];
  const inputKeys    = Object.keys(first.inputs);
  const expectedKeys = Object.keys(first.expected);
  const header       = ['Test Case ID', ...inputKeys, ...expectedKeys];
  const records      = testCases.map(tc => [
    tc.testCaseID,
    ...inputKeys.map(k => tc.inputs[k]),
    ...expectedKeys.map(k => tc.expected[k])
  ]);
  const csvData = stringify([header, ...records]);

  // ─── Syntax ──────────────────────────────────────────────────
  // reuse your ECP parser to pull out the new <Syntax> section
  const syntaxDefs    = await processSyntaxDefs(ddPath);
  const syntaxResults = generateSyntaxTests(syntaxDefs);

  return { partitions, testCases, syntaxResults, csvData };
};
