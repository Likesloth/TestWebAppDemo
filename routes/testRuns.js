// routes/testRuns.js
const express = require('express');
const router  = express.Router();
const upload  = require('../utils/upload');
const auth    = require('../middleware/auth');
const {
  createTestRun,
  listTestRuns,
  getTestRun,
  downloadCsv
} = require('../controllers/testRunController');

// 1) CSV download: public, no auth needed
router.get('/:id/csv', downloadCsv);

// 2) All the rest *do* require a valid JWT
router.use(auth);

// POST   /api/runs        → create a run
router.post(
  '/',
  upload.fields([
    { name: 'dataDictionary', maxCount: 1 },
    { name: 'decisionTree',   maxCount: 1 }
  ]),
  createTestRun
);

// GET    /api/runs        → list runs
router.get('/', listTestRuns);

// GET    /api/runs/:id    → get run metadata
router.get('/:id', getTestRun);

module.exports = router;
