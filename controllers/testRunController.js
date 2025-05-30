// controllers/testRunController.js
const ExcelJS    = require('exceljs');
const TestRun = require('../models/TestRun')
const {
  generateAll
} = require('./testGenController')

// POST /api/runs
exports.createTestRun = async (req, res) => {
  try {
    const dd = req.files.dataDictionary[0].path
    const dt = req.files.decisionTree[0].path

    // generate everything
    const {
      partitions,
      testCases,
      syntaxResults,
      ecpCsvData,
      syntaxCsvData,
      combinedCsvData
    } = await generateAll(dd, dt)

    // persist
    const run = await TestRun.create({
      user:                   req.user.id,
      dataDictionaryFilename: req.files.dataDictionary[0].filename,
      decisionTreeFilename:   req.files.decisionTree[0].filename,
      partitions,
      testCases,
      syntaxResults,
      ecpCsvData,
      syntaxCsvData,
      combinedCsvData
    })

    // return URLs for each CSV
    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`
    return res.json({
      success:       true,
      runId:         run._id,
      partitions,
      testCases,
      syntaxResults,
      ecpCsvUrl:     `${base}/ecp-csv`,
      syntaxCsvUrl:  `${base}/syntax-csv`,
      combinedCsvUrl:`${base}/csv`
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}

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
    const run = await TestRun.findOne({ _id: req.params.id, user: req.user.id })
    if (!run) return res.status(404).json({ success: false, error: 'Not found' })

    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`
    return res.json({
      success:       true,
      partitions:    run.partitions,
      testCases:     run.testCases,
      syntaxResults: run.syntaxResults,
      ecpCsvUrl:     `${base}/ecp-csv`,
      syntaxCsvUrl:  `${base}/syntax-csv`,
      combinedCsvUrl:`${base}/csv`
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}

// GET /api/runs/:id/ecp-csv
exports.downloadEcpCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id)
    if (!run) return res.status(404).send('Not found')
    res.header('Content-Type','text/csv')
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
    res.header('Content-Type','text/csv')
    res.attachment(`syntax-${run._id}.csv`)
    res.send(run.syntaxCsvData)
  } catch {
    res.status(500).send('Server error')
  }
}

// GET /api/runs/:id/csv
/**
 * Download combined workbook with two sheets: "ECP Test Cases" and "Syntax Test Cases"
 */
exports.downloadCombined = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).send('Not found');

    // 1) Build a new Excel workbook
    const wb = new ExcelJS.Workbook();

    //
    // 2) ECP sheet
    //
    const ecpSheet = wb.addWorksheet('ECP Test Cases');
    // columns: Test Case ID + all input keys + all expected keys
    const ecpInputKeys    = run.testCases.length
      ? Object.keys(run.testCases[0].inputs)
      : [];
    const ecpExpectedKeys = run.testCases.length
      ? Object.keys(run.testCases[0].expected)
      : [];

    ecpSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      ...ecpInputKeys   .map(k => ({ header: k,            key: k            })),
      ...ecpExpectedKeys.map(k => ({ header: k,            key: `exp_${k}`    }))
    ];

    // add each row
    run.testCases.forEach(tc => {
      const row = { testCaseID: tc.testCaseID };
      ecpInputKeys.forEach(k => row[k]         = tc.inputs[k]);
      ecpExpectedKeys.forEach(k => row[`exp_${k}`] = tc.expected[k]);
      ecpSheet.addRow(row);
    });

    //
    // 3) Syntax sheet
    //
    const syntaxSheet = wb.addWorksheet('Syntax Test Cases');
    // columns: Name, valid, invalidValue, invalidOmission, invalidAddition, invalidSubstitution
    syntaxSheet.columns = [
      { header: 'Name',                 key: 'name'                },
      { header: 'Valid',                key: 'valid'               },
      { header: 'Invalid Value',        key: 'invalidValue'        },
      { header: 'Invalid Omission',     key: 'invalidOmission'     },
      { header: 'Invalid Addition',     key: 'invalidAddition'     },
      { header: 'Invalid Substitution', key: 'invalidSubstitution' }
    ];

    run.syntaxResults.forEach(sr => {
      syntaxSheet.addRow({
        name:             sr.name,
        valid:            sr.testCases.valid,
        invalidValue:     sr.testCases.invalidValue,
        invalidOmission:  sr.testCases.invalidOmission,
        invalidAddition:  sr.testCases.invalidAddition,
        invalidSubstitution: sr.testCases.invalidSubstitution
      });
    });

    //
    // 4) Stream it back
    //
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="testRun-${run._id}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};
