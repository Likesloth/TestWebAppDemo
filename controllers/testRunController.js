// controllers/testRunController.js
const ExcelJS = require('exceljs');
const TestRun = require('../models/TestRun');
const { generateAll } = require('./testGenController');

// POST /api/runs
exports.createTestRun = async (req, res) => {
  try {
    // 1) grab buffers from multer.memoryStorage()
    const ddBuffer = req.files.dataDictionary[0].buffer;
    const dtBuffer = req.files.decisionTree[0].buffer;
    const smBuffer = req.files.stateMachine?.[0]?.buffer; // optional

    // grab original filenames for metadata
    const ddName = req.files.dataDictionary[0].originalname;
    const dtName = req.files.decisionTree[0].originalname;

    // 2) generate everything
    const {
      partitions,
      testCases,
      syntaxResults,
      stateValid,
      stateInvalid,
      ecpCsvData,
      syntaxCsvData,
      stateCsvData,
      combinedCsvData
    } = await generateAll(ddBuffer, dtBuffer, smBuffer);

    // combine valid + invalid into one array for persistence
    const stateTests = [...stateValid, ...stateInvalid];

    // 3) persist to Mongo
    const run = await TestRun.create({
      user: req.user.id,
      dataDictionaryFilename: ddName,
      decisionTreeFilename:   dtName,
      partitions,
      testCases,
      syntaxResults,
      stateTests,
      ecpCsvData,
      syntaxCsvData,
      stateCsvData,
      combinedCsvData
    });

    // 4) return metadata + URLs
    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;
    const stateValidArr   = stateTests.filter(tc => tc.type === 'Valid');
    const stateInvalidArr = stateTests.filter(tc => tc.type === 'Invalid');

    return res.json({
      success:       true,
      runId:         run._id,
      partitions,
      testCases,
      syntaxResults,
      stateValid:    stateValidArr,
      stateInvalid:  stateInvalidArr,
      ecpCsvUrl:     `${base}/ecp-csv`,
      syntaxCsvUrl:  `${base}/syntax-csv`,
      stateCsvUrl:   `${base}/state-csv`,
      combinedCsvUrl:`${base}/csv`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs
exports.listTestRuns = async (req, res) => {
  try {
    const runs = await TestRun.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('_id dataDictionaryFilename decisionTreeFilename createdAt');
    return res.json({ success: true, runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id
exports.getTestRun = async (req, res) => {
  try {
    const run = await TestRun.findOne({ _id: req.params.id, user: req.user.id });
    if (!run) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    // split stored stateTests into valid and invalid for response
    const stateValidArr   = run.stateTests.filter(tc => tc.type === 'Valid');
    const stateInvalidArr = run.stateTests.filter(tc => tc.type === 'Invalid');

    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;
    return res.json({
      success:       true,
      partitions:    run.partitions,
      testCases:     run.testCases,
      syntaxResults: run.syntaxResults,
      stateTests:    run.stateTests,
      stateValid:    stateValidArr,
      stateInvalid:  stateInvalidArr,
      ecpCsvUrl:     `${base}/ecp-csv`,
      syntaxCsvUrl:  `${base}/syntax-csv`,
      stateCsvUrl:   `${base}/state-csv`,
      combinedCsvUrl:`${base}/csv`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id/ecp-csv
exports.downloadEcpCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`ecp-${run._id}.csv`);
    res.send(run.ecpCsvData);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/syntax-csv
exports.downloadSyntaxCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`syntax-${run._id}.csv`);
    res.send(run.syntaxCsvData);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/state-csv
exports.downloadStateCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`state-${run._id}.csv`);
    res.send(run.stateCsvData);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/csv → combined Excel workbook
exports.downloadCombined = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).send('Not found');

    // split stored stateTests into valid and invalid
    const stateValid   = run.stateTests.filter(tc => tc.type === 'Valid');
    const stateInvalid = run.stateTests.filter(tc => tc.type === 'Invalid');

    const wb = new ExcelJS.Workbook();

    // ECP sheet
    const ecpSheet = wb.addWorksheet('ECP Test Cases');
    const ecpInputKeys    = run.testCases.length ? Object.keys(run.testCases[0].inputs) : [];
    const ecpExpectedKeys = run.testCases.length ? Object.keys(run.testCases[0].expected) : [];
    ecpSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      ...ecpInputKeys.map(k => ({ header: k, key: k })),
      ...ecpExpectedKeys.map(k => ({ header: k, key: `exp_${k}` }))
    ];
    run.testCases.forEach(tc => {
      const row = { testCaseID: tc.testCaseID };
      ecpInputKeys.forEach(k => row[k] = tc.inputs[k]);
      ecpExpectedKeys.forEach(k => row[`exp_${k}`] = tc.expected[k]);
      ecpSheet.addRow(row);
    });

    // Syntax sheet
    const syntaxSheet = wb.addWorksheet('Syntax Test Cases');
    syntaxSheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'Valid', key: 'valid' },
      { header: 'Invalid Value', key: 'invalidValue' },
      { header: 'Invalid Omission', key: 'invalidOmission' },
      { header: 'Invalid Addition', key: 'invalidAddition' },
      { header: 'Invalid Substitution', key: 'invalidSubstitution' }
    ];
    run.syntaxResults.forEach(sr => {
      syntaxSheet.addRow({
        name:               sr.name,
        valid:              sr.testCases.valid,
        invalidValue:       sr.testCases.invalidValue,
        invalidOmission:    sr.testCases.invalidOmission,
        invalidAddition:    sr.testCases.invalidAddition,
        invalidSubstitution:sr.testCases.invalidSubstitution
      });
    });

    // State sheet
    const stateSheet = wb.addWorksheet('State Test Cases');
    stateSheet.columns = [
      { header: 'Type', key: 'type' },
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Start State', key: 'startState' },
      { header: 'Event', key: 'event' },
      { header: 'Expected State', key: 'expectedState' }
    ];
    stateValid.forEach(tc => {
      stateSheet.addRow({
        type:          'Valid',
        testCaseID:    tc.testCaseID,
        startState:    tc.startState,
        event:         tc.event,
        expectedState: tc.expectedState
      });
    });
    stateInvalid.forEach(tc => {
      stateSheet.addRow({
        type:          'Invalid',
        testCaseID:    tc.testCaseID,
        startState:    tc.startState,
        event:         tc.event,
        expectedState: tc.expectedState
      });
    });

    // stream workbook
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="testRun-${run._id}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};
