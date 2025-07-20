// controllers/testRunController.js
const ExcelJS = require('exceljs')
const TestRun = require('../models/TestRun')
const { generateAll } = require('./testGenController')

// POST /api/runs
exports.createTestRun = async (req, res) => {
  try {
    // 1) grab all three uploads
    const ddPath = req.files.dataDictionary[0].path;
    const dtPath = req.files.decisionTree[0].path;
    // may or may not have been uploaded:
    const smPath = req.files.stateMachine?.[0]?.path

    // 2) generate everything, now passing smPath
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
    } = await generateAll(ddPath, dtPath, smPath);

    // 3) persist
    const run = await TestRun.create({
      user: req.user.id,
      dataDictionaryFilename: req.files.dataDictionary[0].filename,
      decisionTreeFilename: req.files.decisionTree[0].filename,
      partitions,
      testCases,
      syntaxResults,
      stateValid,
      stateInvalid,
      ecpCsvData,
      syntaxCsvData,
      stateCsvData,
      combinedCsvData
    });

    // 4) return metadata + URLs
    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;
    return res.json({
      success: true,
      runId: run._id,
      partitions,
      testCases,
      syntaxResults,
      stateValid,
      stateInvalid,
      ecpCsvUrl: `${base}/ecp-csv`,
      syntaxCsvUrl: `${base}/syntax-csv`,
      stateCsvUrl: `${base}/state-csv`,
      combinedCsvUrl: `${base}/csv`
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
      .select('_id dataDictionaryFilename decisionTreeFilename createdAt')
    return res.json({ success: true, runs })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}

// GET /api/runs/:id
exports.getTestRun = async (req, res) => {
  try {
    const run = await TestRun.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    if (!run) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;

    return res.json({
      success: true,
      partitions: run.partitions,
      testCases: run.testCases,
      syntaxResults: run.syntaxResults,
      stateTests: run.stateTests,
      ecpCsvUrl: `${base}/ecp-csv`,
      syntaxCsvUrl: `${base}/syntax-csv`,
      stateCsvUrl: `${base}/state-csv`,
      combinedCsvUrl: `${base}/csv`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id/ecp-csv
exports.downloadEcpCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id)
    if (!run) return res.status(404).send('Not found')
    res.header('Content-Type', 'text/csv')
    res.attachment(`ecp-${run._id}.csv`)
    res.send(run.ecpCsvData)
  } catch {
    res.status(500).send('Server error')
  }
}

// GET /api/runs/:id/syntax-csv
exports.downloadSyntaxCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id)
    if (!run) return res.status(404).send('Not found')
    res.header('Content-Type', 'text/csv')
    res.attachment(`syntax-${run._id}.csv`)
    res.send(run.syntaxCsvData)
  } catch {
    res.status(500).send('Server error')
  }
}

// GET /api/runs/:id/state-csv
exports.downloadStateCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id)
    if (!run) return res.status(404).send('Not found')
    res.header('Content-Type', 'text/csv')
    res.attachment(`state-${run._id}.csv`)
    res.send(run.stateCsvData)
  } catch {
    res.status(500).send('Server error')
  }
}

// GET /api/runs/:id/csv  → combined Excel workbook
exports.downloadCombined = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean()
    if (!run) return res.status(404).send('Not found')

    const wb = new ExcelJS.Workbook()

    // ECP sheet
    const ecpSheet = wb.addWorksheet('ECP Test Cases')
    const ecpInputKeys = run.testCases.length ? Object.keys(run.testCases[0].inputs) : []
    const ecpExpectedKeys = run.testCases.length ? Object.keys(run.testCases[0].expected) : []
    ecpSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      ...ecpInputKeys.map(k => ({ header: k, key: k })),
      ...ecpExpectedKeys.map(k => ({ header: k, key: `exp_${k}` }))
    ]
    run.testCases.forEach(tc => {
      const row = { testCaseID: tc.testCaseID }
      ecpInputKeys.forEach(k => row[k] = tc.inputs[k])
      ecpExpectedKeys.forEach(k => row[`exp_${k}`] = tc.expected[k])
      ecpSheet.addRow(row)
    })

    // Syntax sheet
    const syntaxSheet = wb.addWorksheet('Syntax Test Cases')
    syntaxSheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'Valid', key: 'valid' },
      { header: 'Invalid Value', key: 'invalidValue' },
      { header: 'Invalid Omission', key: 'invalidOmission' },
      { header: 'Invalid Addition', key: 'invalidAddition' },
      { header: 'Invalid Substitution', key: 'invalidSubstitution' }
    ]
    run.syntaxResults.forEach(sr => {
      syntaxSheet.addRow({
        name: sr.name,
        valid: sr.testCases.valid,
        invalidValue: sr.testCases.invalidValue,
        invalidOmission: sr.testCases.invalidOmission,
        invalidAddition: sr.testCases.invalidAddition,
        invalidSubstitution: sr.testCases.invalidSubstitution
      })
    })

    // State sheet
    const stateSheet = wb.addWorksheet('State Test Cases')
    stateSheet.columns = [
      { header: 'Type', key: 'type' },
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Start State', key: 'startState' },
      { header: 'Event', key: 'event' },
      { header: 'Expected State', key: 'expectedState' }
    ]
    run.stateValid.forEach(tc => {
      stateSheet.addRow({
        type: 'Valid',
        testCaseID: tc.testCaseID,
        startState: tc.startState,
        event: tc.event,
        expectedState: tc.expectedState
      })
    })
    run.stateInvalid.forEach(tc => {
      stateSheet.addRow({
        type: 'Invalid',
        testCaseID: tc.testCaseID,
        startState: tc.startState,
        event: tc.event,
        expectedState: '<no transition>'
      })
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="testRun-${run._id}.xlsx"`
    )
    await wb.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error(err)
    res.status(500).send('Server error')
  }
}
