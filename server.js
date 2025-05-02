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

// 2) Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// 3) Authentication routes
app.use('/api/auth', authRoutes);

// 4) TestRun (history) routes — protected by your auth middleware internally
app.use('/api/runs', testRunRoutes);

// 5) Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
