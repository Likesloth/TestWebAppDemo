// backend/utils/upload.js
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const UPLOAD_DIR = path.join(__dirname, '../uploads')

// ensure uploads/ exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR)

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename(req, file, cb) {
    const ext       = path.extname(file.originalname)
    const name      = path.basename(file.originalname, ext)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    cb(null, `${name}_${timestamp}${ext}`)
  }
})

module.exports = multer({ storage })
