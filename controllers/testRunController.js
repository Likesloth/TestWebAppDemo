// controllers/testRunController.js

const TestRun    = require('../models/TestRun');
const { generateAll } = require('./testGenController');

exports.createTestRun = async (req, res) => {
  try {
    const dd = req.files.dataDictionary[0].path;
    const dt = req.files.decisionTree  [0].path;

    // Generate partitions, testCases, and in-memory csvData
    const { partitions, testCases, csvData } = await generateAll(dd, dt);

    // Persist into MongoDB
    const run = await TestRun.create({
      user:                   req.user.id,
      dataDictionaryFilename: req.files.dataDictionary[0].filename,
      decisionTreeFilename:   req.files.decisionTree  [0].filename,
      partitions,
      testCases,
      csvData
    });

    // Respond with everything the frontend needs
    return res.json({
      success:    true,
      runId:      run._id,
      partitions,
      testCases,
      csvUrl:     `${req.protocol}://${req.get('host')}/api/runs/${run._id}/csv`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

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


// this returns JSON for a single run
exports.getTestRun = async (req, res) => {
  const run = await TestRun.findOne({ _id: req.params.id, user: req.user.id });
  if (!run) return res.status(404).json({ success: false, error: 'Not found' });

  // tell the front-end where to download CSV
  const csvUrl = `${req.protocol}://${req.get('host')}/api/runs/${run._id}/csv`;
  return res.json({
    success:    true,
    partitions: run.partitions,
    testCases:  run.testCases,
    csvUrl
  });
};

// new: stream the CSV from the csvData field
exports.downloadCsv = async (req, res) => {
  try {
    const run = await TestRun.findOne({ _id: req.params.id });
    if (!run) return res.status(404).send('Not found');

    res.header('Content-Type', 'text/csv');
    res.attachment(`testRun-${run._id}.csv`);
    res.send(run.csvData);
  } catch (err) {
    res.status(500).send('Server error');
  }
};