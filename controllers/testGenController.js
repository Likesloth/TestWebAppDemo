// controllers/testGenController.js

const { stringify }          = require('csv-stringify/sync');
const generatePartitions     = require('../utils/partitionGenerator');
const generateTestCasesLogic = require('../utils/testCaseGenerator');

module.exports.generateAll = async (dataDictionaryPath, decisionTreePath) => {
  // 1) Generate partitions
  const partitions = await generatePartitions(dataDictionaryPath);

  // 2) Generate test cases (dynamic inputs/expected maps)
  const testCases  = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath);

  if (!testCases.length) {
    throw new Error('No test cases generated');
  }

  // 3) Build CSV headers from the first test case
  const first        = testCases[0];
  const inputKeys    = Object.keys(first.inputs);
  const expectedKeys = Object.keys(first.expected);
  const header       = ['Test Case ID', ...inputKeys, ...expectedKeys];

  // 4) Flatten each test case into an array of values
  const records = testCases.map(tc => [
    tc.testCaseID,
    ...inputKeys.map(k => tc.inputs[k]),
    ...expectedKeys.map(k => tc.expected[k])
  ]);

  // 5) Stringify to CSV in-memory
  const csvData = stringify([header, ...records]);

  // 6) Return everything
  return { partitions, testCases, csvData };
};
