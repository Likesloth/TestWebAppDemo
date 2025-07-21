// backend/utils/upload.js
const multer = require('multer');

// Store uploads in memory rather than writing to disk
const storage = multer.memoryStorage();

module.exports = multer({ storage });
