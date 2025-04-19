// backend/utils/upload.js
const multer = require('multer');
const path  = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext       = path.extname(file.originalname);
    const base      = path.basename(file.originalname, ext);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')  // make it filename‑safe
      .replace('T', '_')      // 2025-04-19_15-30-45-123
      .slice(0,-1);           // drop the trailing Z
    cb(null, `${base}_${timestamp}${ext}`);
  }
});

module.exports = multer({ storage });
