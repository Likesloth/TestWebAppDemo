// routes/testRuns.js
const express = require('express')
const router  = express.Router()
const upload  = require('../utils/upload')
const auth    = require('../middleware/auth')
const {
  createTestRun,
  listTestRuns,
  getTestRun,
  downloadEcpCsv,
  downloadSyntaxCsv,
  downloadCombined  
} = require('../controllers/testRunController')
const validateUploadedXml = require('../utils/xmlValidator')

// Public download endpoints
router.get('/:id/ecp-csv',    downloadEcpCsv)
router.get('/:id/syntax-csv', downloadSyntaxCsv)
router.get('/:id/csv',        downloadCombined)  // ← use downloadCombined, not downloadCsv

// All the rest require auth
router.use(auth)

router.post(
  '/',
  upload.fields([
    { name: 'dataDictionary', maxCount: 1 },
    { name: 'decisionTree',   maxCount: 1 }
  ]),
  validateUploadedXml,
  createTestRun
)

router.get('/',  listTestRuns)
router.get('/:id', getTestRun)

module.exports = router
