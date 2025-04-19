// backend/controllers/testRunController.js
const path      = require('path');
const TestRun   = require('../models/TestRun');
const { generateAll } = require('./testGenController');

exports.createTestRun = async (req, res) => {
    try {
      // 1) Generate files & get back the full csv path on disk
      const dd = req.files.dataDictionary[0].path;
      const dt = req.files.decisionTree  [0].path;
      const { partitions, testCases, csvFile } = await generateAll(dd, dt);
  
      // 2) Derive just the filename
      const csvFilename = path.basename(csvFile);
  
      // 3) Save to MongoDB
      const run = await TestRun.create({
        user:                   req.user.id,
        dataDictionaryFilename: req.files.dataDictionary[0].filename,
        decisionTreeFilename:   req.files.decisionTree[0].filename,
        partitions,
        testCases,
        csvFilename
      });
  
      // 4) Build a public URL
      const csvUrl = `${req.protocol}://${req.get('host')}/exports/${csvFilename}`;
  
      // 5) Return everything in one JSON response
      return res.json({
        success: true,
        runId:   run._id,
        csvUrl
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

exports.listTestRuns = async (req, res) => {
  try {
    const runs = await TestRun.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('_id dataDictionaryFilename decisionTreeFilename createdAt csvFilename');
    res.json(runs);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTestRun = async (req, res) => {
    try {
      const run = await TestRun.findOne({
        _id:  req.params.id,
        user: req.user.id
      });
      if (!run) return res.status(404).json({ success:false, error:'Not found' });
  
      // Derive URL again
      const csvUrl = `${req.protocol}://${req.get('host')}/exports/${run.csvFilename}`;
  
      return res.json({
        success:   true,
        run:       run,
        csvUrl
      });
    } catch (err) {
      return res.status(500).json({ success:false, error:err.message });
    }
  };
