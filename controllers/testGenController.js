// controllers/testGenController.js

const { stringify } = require('csv-stringify/sync');
const path = require('path');

const generatePartitions = require('../utils/partitionGenerator');
const generateTestCasesLogic = require('../utils/testCaseGenerator');
const { processSyntaxDefs } = require('../utils/syntaxParser');
const { generateSyntaxTests } = require('../utils/syntaxTestGenerator');
const { processStateDefs } = require('../utils/stateParser');
const { generateStateTests } = require('../utils/stateTestGenerator');
const { enumerateStateSequences } = require('../utils/stateSequenceGenerator');


module.exports.generateAll = async (
  dataDictionaryPath,
  decisionTreePath,
  stateMachinePath
) => {
  // 1) ECP
  const partitions = await generatePartitions(dataDictionaryPath);
  const testCases = await generateTestCasesLogic(dataDictionaryPath, decisionTreePath);

  // 2) Syntax
  const syntaxDefs = await processSyntaxDefs(dataDictionaryPath);
  const syntaxResults = generateSyntaxTests(syntaxDefs);

// 3) State‐transition (optional)
let valid = [];
let invalid = [];
let stateCsvData = '';
let stateHeader = [];
let stateRows = [];
let stateSequences = [];
let stateSeqCsvData = '';

if (stateMachinePath) {
  // parse states and also get initialId for sequences
  const { states, events, transitions, initialId } = await processStateDefs(stateMachinePath);

  // single-step valid/invalid generation
  const results = generateStateTests({ states, events, transitions });
  valid = results.valid;
  invalid = results.invalid;

  // --- State CSV (single-step) ---
  stateHeader = ['Type', 'Test Case ID', 'Start State', 'Event', 'Expected State'];
  stateRows = [
    ...valid.map(tc   => ['Valid',   tc.testCaseID, tc.startState, tc.event,   tc.expectedState]),
    ...invalid.map(tc => ['Invalid', tc.testCaseID, tc.startState, tc.event,   tc.expectedState])
  ];
  stateCsvData = stringify([stateHeader, ...stateRows]);

  // --- Sequences (prefix paths from initial; no events; not required to end at final) ---
  if (!initialId) {
    throw new Error('StateMachine XML has no <initial id="..."> node; cannot enumerate sequences.');
  }

  stateSequences = enumerateStateSequences({
    initialId,
    transitions,
    maxDepth: 8
  });

  const seqHeader = ['Sequence Case ID', 'Sequence'];
  const seqRows = stateSequences.map(s => [
    s.seqCaseID,
    s.sequence.join(' → ')
  ]);
  stateSeqCsvData = stringify([seqHeader, ...seqRows]);
}


  // --- ECP CSV ---
  const ecpInputKeys = testCases.length ? Object.keys(testCases[0].inputs) : [];
  const ecpExpectedKeys = testCases.length ? Object.keys(testCases[0].expected) : [];
  const ecpHeader = ['Test Case ID', ...ecpInputKeys, ...ecpExpectedKeys];
  const ecpRows = testCases.map(tc => [
    tc.testCaseID,
    ...ecpInputKeys.map(k => tc.inputs[k]),
    ...ecpExpectedKeys.map(k => tc.expected[k])
  ]);
  const ecpCsvData = stringify([ecpHeader, ...ecpRows]);

  // --- Syntax CSV ---
  const synHeader = ['Name', 'valid', 'invalidValue', 'invalidOmission', 'invalidAddition', 'invalidSubstitution'];
  const synRows = syntaxResults.map(sr => [
    sr.name,
    sr.testCases.valid,
    sr.testCases.invalidValue,
    sr.testCases.invalidOmission,
    sr.testCases.invalidAddition,
    sr.testCases.invalidSubstitution
  ]);
  const syntaxCsvData = stringify([synHeader, ...synRows]);

  // 6) Combined CSV (kept as-is; not strictly needed for sequences-in-same-sheet Excel)
  const combinedHeader = ['Technique', ...ecpHeader, ...synHeader, 'Seq/State Type', 'ID', 'Start/Path', 'Event', 'Expected/Coverage'];
  const combinedRows = [
    ...ecpRows.map(r => ['ECP', ...r, ...Array(synHeader.length).fill(''), '', '', '', '', '']),
    ...synRows.map(r => ['Syntax', ...Array(ecpHeader.length).fill(''), ...r, '', '', '', '', '']),
    ...valid.map(tc => ['State', ...Array(ecpHeader.length + synHeader.length).fill(''), 'Valid', tc.testCaseID, tc.startState, tc.event, tc.expectedState]),
    ...invalid.map(tc => ['State', ...Array(ecpHeader.length + synHeader.length).fill(''), 'Invalid', tc.testCaseID, tc.startState, tc.event, tc.expectedState]),
    ...stateSequences.map(s => ['Seq', ...Array(ecpHeader.length + synHeader.length).fill(''),
      'Sequence',
      s.seqCaseID,
      s.sequence.join(' → '),
      '',
      ''
    ])
  ];
  const combinedCsvData = stringify([combinedHeader, ...combinedRows]);

  // --- Return everything ---
  return {
    partitions,
    testCases,
    syntaxResults,
    stateValid: valid,
    stateInvalid: invalid,
    stateSequences,
    ecpCsvData,
    syntaxCsvData,
    stateCsvData,
    stateSeqCsvData,
    combinedCsvData
  };
};
