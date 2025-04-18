const fs   = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const generatePartitions      = require('../utils/partitionGenerator');
const generateTestCasesLogic  = require('../utils/testCaseGenerator');

async function exportCSV(testCases) {
  const dir = path.join(__dirname, '../exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filename = `testCases-${Date.now()}.csv`;
  const filePath = path.join(dir, filename);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'testCaseID',       title: 'Test Case ID' },
      { id: 'orderPrice',       title: 'Order Price' },
      { id: 'customerType',     title: 'Customer Type' },
      { id: 'expectedDiscount', title: 'Expected Discount' }
    ]
  });

  await csvWriter.writeRecords(testCases);
  return filePath;
}

module.exports.generateAll = async (ddPath, dtPath) => {
  const partitions = await generatePartitions(ddPath);
  const testCases  = await generateTestCasesLogic(ddPath, dtPath);
  const csvFile    = await exportCSV(testCases);
  return { partitions, testCases, csvFile };
};
