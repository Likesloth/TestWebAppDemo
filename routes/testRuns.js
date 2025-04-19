const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const ctrl    = require('../controllers/testRunController');
const upload  = require('../utils/upload');

// create + generate → must be logged in
router.post(
  '/',
  auth,
  upload.fields([
    { name: 'dataDictionary' },
    { name: 'decisionTree' }
  ]),
  ctrl.createTestRun
);

// list & detail → must be logged in
router.get('/',    auth, ctrl.listTestRuns);
router.get('/:id', auth, ctrl.getTestRun);

module.exports = router;
