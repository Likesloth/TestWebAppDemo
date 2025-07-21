// controllers/testGenController.js

const { stringify } = require('csv-stringify/sync')
const path = require('path')

const generatePartitions     = require('../utils/partitionGenerator')
const generateTestCasesLogic = require('../utils/testCaseGenerator')
const { processSyntaxDefs }  = require('../utils/syntaxParser')
const { generateSyntaxTests }= require('../utils/syntaxTestGenerator')
const { processStateDefs }   = require('../utils/stateParser')
const { generateStateTests } = require('../utils/stateTestGenerator')

module.exports.generateAll = async (
  dataDictionaryPath,
  decisionTreePath,
  stateMachinePath   // ← new third parameter
) => {
  // 1) ECP
  const partitions = await generatePartitions(dataDictionaryPath)
  const testCases  = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath)

  // 2) Syntax
  const syntaxDefs     = await processSyntaxDefs(dataDictionaryPath)
  const syntaxResults  = generateSyntaxTests(syntaxDefs)

  // 3) State-transition: only if they passed in a buffer/path
  let valid = []
  let invalid = []
  let stateCsvData = ''

  if (stateMachinePath) {
    // parse and generate
    const { states, events, transitions } = await processStateDefs(stateMachinePath)
    const results = generateStateTests({ states, events, transitions })
    valid   = results.valid
    invalid = results.invalid

    // --- State CSV ---
    const stateHeader = [
      'Type',
      'Test Case ID',
      'Start State',
      'Event',
      'Expected State'
    ]
    const stateRows = [
      ...valid.map(tc   => ['Valid',   tc.testCaseID, tc.startState, tc.event,   tc.expectedState]),
      ...invalid.map(tc => ['Invalid', tc.testCaseID, tc.startState, tc.event, tc.expectedState])
    ]
    stateCsvData = stringify([stateHeader, ...stateRows])
  }

  // --- ECP CSV ---
  const ecpInputKeys    = testCases.length ? Object.keys(testCases[0].inputs) : []
  const ecpExpectedKeys = testCases.length ? Object.keys(testCases[0].expected) : []
  const ecpHeader = ['Test Case ID', ...ecpInputKeys, ...ecpExpectedKeys]
  const ecpRows   = testCases.map(tc => [
    tc.testCaseID,
    ...ecpInputKeys.map(k => tc.inputs[k]),
    ...ecpExpectedKeys.map(k => tc.expected[k])
  ])
  const ecpCsvData = stringify([ecpHeader, ...ecpRows])

  // --- Syntax CSV ---
  const synHeader = [
    'Name',
    'valid',
    'invalidValue',
    'invalidOmission',
    'invalidAddition',
    'invalidSubstitution'
  ]
  const synRows      = syntaxResults.map(sr => [
    sr.name,
    sr.testCases.valid,
    sr.testCases.invalidValue,
    sr.testCases.invalidOmission,
    sr.testCases.invalidAddition,
    sr.testCases.invalidSubstitution
  ])
  const syntaxCsvData = stringify([synHeader, ...synRows])

  // --- Combined CSV (ECP + Syntax only) ---
  const combinedHeader = ['Technique', ...ecpHeader, ...synHeader]
  const combinedRows   = [
    ...ecpRows.map(r => ['ECP',    ...r, ...Array(synHeader.length).fill('')]),
    ...synRows.map(r => ['Syntax', ...Array(ecpHeader.length).fill(''), ...r])
  ]
  const combinedCsvData = stringify([combinedHeader, ...combinedRows])

  // --- Return everything ---
  return {
    partitions,
    testCases,
    syntaxResults,
    stateValid:    valid,       // empty array if no stateMachinePath
    stateInvalid:  invalid,     // empty array if no stateMachinePath
    ecpCsvData,
    syntaxCsvData,
    stateCsvData,               // empty string if no stateMachinePath
    combinedCsvData
  }
}
