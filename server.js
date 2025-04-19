// backend/server.js
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const path     = require('path');
const upload   = require('./utils/upload');

// Controllers / Routes
const { generateAll } = require('./controllers/testGenController');
const authRoutes      = require('./routes/auth');
const testRunRoutes   = require('./routes/testRuns');

const app = express();

// 1) Middleware
app.use(cors());
app.use(express.json());

// 2) Serve CSV files from /exports via HTTP
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// 3) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// 4) Legacy “in‑memory” generate route
app.post(
  '/api/generate',
  upload.fields([
    { name: 'dataDictionary', maxCount: 1 },
    { name: 'decisionTree',   maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const dd = req.files.dataDictionary[0].path;
      const dt = req.files.decisionTree[0].path;
      const { partitions, testCases, csvFile } = await generateAll(dd, dt);
      res.json({ success: true, partitions, testCases, csvFile });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 5) Authentication routes
app.use('/api/auth', authRoutes);

// 6) TestRun (history) routes — protected by your auth middleware internally
app.use('/api/runs', testRunRoutes);

// 7) Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
