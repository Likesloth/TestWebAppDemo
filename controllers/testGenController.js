// controllers/testGenController.js

const { stringify }          = require('csv-stringify/sync')
const generatePartitions     = require('../utils/partitionGenerator')
const generateTestCasesLogic = require('../utils/testCaseGenerator')

// ECP XML parsing
const {
  processDataDictionary,
  processDecisionTree
} = require('../utils/ecpParser')

// Syntax XML parsing + test generation
const { processSyntaxDefs }   = require('../utils/syntaxParser')
const { generateSyntaxTests } = require('../utils/syntaxTestGenerator')

module.exports.generateAll = async (dataDictionaryPath, decisionTreePath) => {
  // 1) ECP partitions & test cases
  const partitions = await generatePartitions(dataDictionaryPath)
  const testCases  = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath)

  // 2) Syntax definitions & test cases
  const syntaxDefs    = await processSyntaxDefs(dataDictionaryPath)
  const syntaxResults = generateSyntaxTests(syntaxDefs)

  // 3) Build ECP-only CSV
  const ecpInputKeys = testCases.length ? Object.keys(testCases[0].inputs) : []
  const ecpExpectedKeys = testCases.length ? Object.keys(testCases[0].expected) : []
  const ecpHeader = [
    'Test Case ID',
    ...ecpInputKeys,
    ...ecpExpectedKeys
  ]
  const ecpRows = testCases.map(tc => [
    tc.testCaseID,
    ...ecpInputKeys.map(k => tc.inputs[k]),
    ...ecpExpectedKeys.map(k => tc.expected[k])
  ])
  const ecpCsvData = stringify([ecpHeader, ...ecpRows])

  // 4) Build Syntax-only CSV
  const synHeader = [
    'Name',
    'valid',
    'invalidValue',
    'invalidOmission',
    'invalidAddition',
    'invalidSubstitution'
  ]
  const synRows = syntaxResults.map(sr => [
    sr.name,
    sr.testCases.valid,
    sr.testCases.invalidValue,
    sr.testCases.invalidOmission,
    sr.testCases.invalidAddition,
    sr.testCases.invalidSubstitution
  ])
  const syntaxCsvData = stringify([synHeader, ...synRows])

  // 5) Build combined CSV (tags each row with Technique)
  const combinedHeader = [
    'Technique',
    ...ecpHeader,           // ECP columns
    ...synHeader.slice(5)   // Syntax test-case columns only
  ]
  const combinedRows = [
    ...testCases.map(tc => [
      'ECP',
      tc.testCaseID,
      ...ecpInputKeys.map(k => tc.inputs[k]),
      ...ecpExpectedKeys.map(k => tc.expected[k]),
      // blank placeholders for syntax-columns
      ...Array(synHeader.length - 5).fill('')
    ]),
    ...syntaxResults.map((sr, idx) => [
      'Syntax',
      `ST${String(idx+1).padStart(3,'0')}`,
      // blank placeholders for ECP columns
      ...Array(ecpHeader.length - 1).fill(''),
      sr.testCases.valid,
      sr.testCases.invalidValue,
      sr.testCases.invalidOmission,
      sr.testCases.invalidAddition,
      sr.testCases.invalidSubstitution
    ])
  ]
  const combinedCsvData = stringify([combinedHeader, ...combinedRows])

  return {
    partitions,
    testCases,
    syntaxResults,
    ecpCsvData,
    syntaxCsvData,
    combinedCsvData
  }
}
