// controllers/testGenController.js

const { stringify } = require('csv-stringify/sync');
const path = require('path');

const generatePartitions     = require('../utils/partitionGenerator');
const generateTestCasesLogic = require('../utils/testCaseGenerator');
const { processSyntaxDefs }  = require('../utils/syntaxParser');
const { generateSyntaxTests }= require('../utils/syntaxTestGenerator');
const { processStateDefs }   = require('../utils/stateParser');
const { generateStateTests } = require('../utils/stateTestGenerator');

module.exports.generateAll = async (
  dataDictionaryPath,
  decisionTreePath,
  stateMachinePath
) => {
  // 1) ECP
  const partitions = await generatePartitions(dataDictionaryPath);
  const testCases  = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath);

  // 2) Syntax
  const syntaxDefs     = await processSyntaxDefs(dataDictionaryPath);
  const syntaxResults  = generateSyntaxTests(syntaxDefs);

  // 3) State‐transition (optional)
  let valid = [], invalid = [], stateCsvData = '', stateHeader = [], stateRows = [];
  if (stateMachinePath) {
    const { states, events, transitions } = await processStateDefs(stateMachinePath);
    ({ valid, invalid } = generateStateTests({ states, events, transitions }));

    // --- State CSV ---
    stateHeader = ['Type','Test Case ID','Start State','Event','Expected State'];
    stateRows   = [
      ...valid.map(tc   => ['Valid',   tc.testCaseID, tc.startState, tc.event, tc.expectedState]),
      ...invalid.map(tc => ['Invalid', tc.testCaseID, tc.startState, tc.event, tc.expectedState])
    ];
    stateCsvData = stringify([stateHeader, ...stateRows]);
  }

  // --- ECP CSV ---
  const ecpInputKeys    = testCases.length ? Object.keys(testCases[0].inputs) : [];
  const ecpExpectedKeys = testCases.length ? Object.keys(testCases[0].expected) : [];
  const ecpHeader = ['Test Case ID', ...ecpInputKeys, ...ecpExpectedKeys];
  const ecpRows   = testCases.map(tc => [
    tc.testCaseID,
    ...ecpInputKeys.map(k => tc.inputs[k]),
    ...ecpExpectedKeys.map(k => tc.expected[k])
  ]);
  const ecpCsvData = stringify([ecpHeader, ...ecpRows]);

  // --- Syntax CSV ---
  const synHeader = ['Name','valid','invalidValue','invalidOmission','invalidAddition','invalidSubstitution'];
  const synRows   = syntaxResults.map(sr => [
    sr.name,
    sr.testCases.valid,
    sr.testCases.invalidValue,
    sr.testCases.invalidOmission,
    sr.testCases.invalidAddition,
    sr.testCases.invalidSubstitution
  ]);
  const syntaxCsvData = stringify([synHeader, ...synRows]);

  // --- Combined CSV (ECP + Syntax + State) ---
  // header: Technique + ECP cols + Syntax cols + State cols
  const combinedHeader = [
    'Technique',
    ...ecpHeader,
    ...synHeader,
    ...stateHeader
  ];

  const combinedRows = [
    // 1) ECP rows
    ...ecpRows.map(r => [
      'ECP',
      ...r,
      ...Array(synHeader.length).fill(''),
      ...Array(stateHeader.length).fill('')
    ]),
    // 2) Syntax rows
    ...synRows.map(r => [
      'Syntax',
      ...Array(ecpHeader.length).fill(''),
      ...r,
      ...Array(stateHeader.length).fill('')
    ]),
    // 3) State rows
    ...stateRows.map(r => [
      'State',
      ...Array(ecpHeader.length).fill(''),
      ...Array(synHeader.length).fill(''),
      ...r
    ])
  ];

  const combinedCsvData = stringify([combinedHeader, ...combinedRows]);

  // --- Return everything ---
  return {
    partitions,
    testCases,
    syntaxResults,
    stateValid:    valid,
    stateInvalid:  invalid,
    ecpCsvData,
    syntaxCsvData,
    stateCsvData,
    combinedCsvData
  };
};
