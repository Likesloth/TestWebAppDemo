// controllers/testGenController.js
const path = require('path');
const { generateTestCasesLogic } = require('../utils/testCaseGenerator');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Function to generate test cases from the uploaded XML files
const generateTestCases = async (dataDictionaryPath, decisionTreePath) => {
  const testCases = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath);
  return testCases;
};

// Function to export generated test cases to a CSV file
const exportCSV = async (testCases) => {
  const csvFilePath = path.join(__dirname, '../exports', 'testCases.csv');
  const csvWriter = createCsvWriter({
    path: csvFilePath,
    header: [
      { id: 'testCaseID', title: 'Test Case ID' },
      { id: 'orderPrice', title: 'Order Price' },
      { id: 'customerType', title: 'Customer Type' },
      { id: 'expectedDiscount', title: 'Expected Discount' }
      // You can add additional fields like actual output, status, etc.
    ]
  });

  await csvWriter.writeRecords(testCases);
  return csvFilePath;
};

module.exports = { generateTestCases, exportCSV };
