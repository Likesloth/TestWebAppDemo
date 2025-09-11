// controllers/testGenController.js
const { stringify } = require('csv-stringify/sync');

const generatePartitions = require('../utils/partitionGenerator');
const generateTestCasesLogic = require('../utils/testCaseGenerator');
const { processSyntaxDefs } = require('../utils/syntaxParser');
const { generateSyntaxTests } = require('../utils/syntaxTestGenerator');
const { processStateDefs } = require('../utils/stateParser');
const { enumerateStateSequences } = require('../utils/stateSequenceGenerator');
const { buildTransitionMatrix } = require('../utils/stateMatrixGenerator');

// helper: shape single-transition rows for UI/CSV (5 columns)
function buildStateTestRows(validCases, invalidCases) {
  const merged = [
    ...validCases.map(v => ({ type: 'Valid', from: v.from, to: v.to })),
    ...invalidCases.map(i => ({ type: 'Invalid', from: i.from, to: i.to }))
  ];

  return merged.map((row, idx) => ({
    testCaseID: `TC${String(idx + 1).padStart(3, '0')}`,
    type: row.type,
    startState: row.from,
    transitionDescription: `${row.from} --> ${row.to}`,
    // IMPORTANT: for invalid we still set expectedState = attempted destination
    expectedState: row.to
  }));
}

module.exports.generateAll = async (
  dataDictionaryPath,
  decisionTreePath,
  stateMachinePath
) => {
  // 1) ECP
  const partitions = await generatePartitions(dataDictionaryPath);
  const testCases = await generateTestCasesLogic(
    dataDictionaryPath,
    decisionTreePath
  );

  // 2) Syntax
  const syntaxDefs = await processSyntaxDefs(dataDictionaryPath);
  const syntaxResults = generateSyntaxTests(syntaxDefs);

  // 3) State (optional)
  let stateTests = [];       // five-column rows for UI/CSV
  let stateCsvData = '';     // CSV for single-transition 5-column table
  let stateSequences = [];   // sequences (array of { seqCaseID, sequence[] })
  let stateSeqCsvData = '';  // CSV for sequences (2 columns)

  if (stateMachinePath) {
    // parse state machine (must include initialId/finalIds from your updated parser)
    const { states, transitions, initialId, finalIds } =
      await processStateDefs(stateMachinePath);

    // build matrix and derive valid/invalid single transitions
    const { validCases, invalidCases } = buildTransitionMatrix({
      states,
      transitions,
      initial: initialId || 'Initial',
      finals: finalIds || [],
      includeInitialToFinalInvalid: false
    });

    // 3.1) build 5-column rows (UI table + CSV)
    stateTests = buildStateTestRows(validCases, invalidCases);

    // --- State CSV (single-step) ---
    const singleHeader = [
      'Test Case ID',
      'Type',
      'Start State',
      'Transition Description',
      'Expected State',
      'Coverage (%)'
    ];

    const totalSingles = Math.max(stateTests.length, 1);
    const singleRows = stateTests.map((r, i) => [
      r.testCaseID,
      r.type,
      r.startState,
      r.transitionDescription,
      r.expectedState,
      `${(((i + 1) / totalSingles) * 100).toFixed(2)}%`
    ]);

    stateCsvData = stringify([singleHeader, ...singleRows]);


    // 3.2) sequences (prefix paths from initial; no events; may end at final or dead-end per your generator)
    if (!initialId) {
      throw new Error('StateMachine XML has no <initial id="..."> node; cannot enumerate sequences.');
    }
    stateSequences = enumerateStateSequences({
      initialId,
      transitions,
      finalIds,      // ensure generator knows terminal states
      maxDepth: 8
    });

    // Filter: keep only sequences that end at a final state
    if (finalIds && finalIds.length) {
      const finalSet = new Set(finalIds);
      stateSequences = stateSequences.filter(s => {
        const last = Array.isArray(s.sequence) && s.sequence.length
          ? s.sequence[s.sequence.length - 1]
          : null;
        return last && finalSet.has(last);
      });

      // Renumber seqCaseID to be contiguous after filtering
      stateSequences = stateSequences.map((s, idx) => ({
        ...s,
        seqCaseID: `TC${String(idx + 1).padStart(3, '0')}`
      }));
    }

    // sequences CSV (with Coverage)
    const seqHeader = ['Test Case ID', 'Sequence', 'Coverage (%)'];
    const totalSeq = Math.max(stateSequences.length, 1);
    const seqRows = stateSequences.map((s, i) => [
      `TC${String(i + 1).padStart(3, '0')}`,
      s.sequence.join(' → '),
      `${(((i + 1) / totalSeq) * 100).toFixed(2)}%`
    ]);
    stateSeqCsvData = stringify([seqHeader, ...seqRows]);
  }

  // 4) ECP CSV (with Coverage)
  const ecpInputKeys = testCases.length ? Object.keys(testCases[0].inputs) : [];
  const ecpExpectedKeys = testCases.length ? Object.keys(testCases[0].expected) : [];
  const ecpHeader = ['Test Case ID', 'Type', ...ecpInputKeys, ...ecpExpectedKeys, 'Coverage (%)'];
  const totalEcp = Math.max(testCases.length, 1);
  const ecpRows = testCases.map((tc, idx) => [
    tc.testCaseID,
    tc.type || 'Valid',
    ...ecpInputKeys.map(k => tc.inputs[k]),
    ...ecpExpectedKeys.map(k => tc.expected[k]),
    `${(((idx + 1) / totalEcp) * 100).toFixed(2)}%`
  ]);
  const ecpCsvData = stringify([ecpHeader, ...ecpRows]);

  // 5) Syntax CSV
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

  // 6) Combined CSV (unchanged layout, but now fed from new state rows)
  // We’ll still keep your previous combined layout, just map singles + sequences into it.
  const combinedHeader = [
    'Technique',
    ...ecpHeader,
    ...synHeader,
    'Seq/State Type',
    'ID',
    'Start/Path',
    'Event',
    'Expected/Coverage'
  ];

  // Map single transitions to "State" rows in combined (Event column unused, pass empty)
  const combinedStateRows = stateTests.map(r => [
    'State',
    ...Array(ecpHeader.length + synHeader.length).fill(''),
    r.type,
    r.testCaseID,
    r.transitionDescription, // put full "from --> to" in Start/Path
    '',                      // Event (unused in new table)
    r.expectedState
  ]);

  // Map sequences to "Seq" rows in combined (fill coverage in last column)
  const totalSeqForCombined = Math.max(stateSequences.length, 1);
  const combinedSeqRows = stateSequences.map((s, i) => [
    'Seq',
    ...Array(ecpHeader.length + synHeader.length).fill(''),
    'Sequence',
    s.seqCaseID || '',              // if your enumerateStateSequences returns seqCaseID
    s.sequence.join(' → '),
    '',
    `${(((i + 1) / totalSeqForCombined) * 100).toFixed(2)}%`
  ]);

  const combinedRows = [
    ...ecpRows.map(r => ['ECP', ...r, ...Array(synHeader.length).fill(''), '', '', '', '', '']),
    ...synRows.map(r => ['Syntax', ...Array(ecpHeader.length).fill(''), ...r, '', '', '', '', '']),
    ...combinedStateRows,
    ...combinedSeqRows
  ];
  const combinedCsvData = stringify([combinedHeader, ...combinedRows]);

  // 7) Return everything (note: we now return stateTests as the 5-column rows)
  return {
    partitions,
    testCases,
    syntaxResults,
    stateTests,        // five-column single-transition rows for the UI
    stateSequences,    // sequences array for the sequences sheet/CSV
    ecpCsvData,
    syntaxCsvData,
    stateCsvData,      // CSV of the 5-column single transitions
    stateSeqCsvData,   // CSV of sequences (if you still expose a separate endpoint)
    combinedCsvData
  };
};
