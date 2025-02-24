// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { generateTestCases, exportCSV } = require('./controllers/testGenController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure you create this folder in your backend directory
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// API endpoint to process XML files and generate test cases
app.post('/api/generate', upload.fields([
  { name: 'dataDictionary', maxCount: 1 },
  { name: 'decisionTree', maxCount: 1 }
]), async (req, res) => {
  try {
    const dataDictionaryPath = req.files.dataDictionary[0].path;
    const decisionTreePath = req.files.decisionTree[0].path;

    // Generate test cases based on the uploaded files
    const testCases = await generateTestCases(dataDictionaryPath, decisionTreePath);
    // Optionally, save test cases to MongoDB here

    // Generate CSV report from the test cases
    const csvFilePath = await exportCSV(testCases);

    res.status(200).json({ success: true, testCases, csvFile: csvFilePath });
  } catch (error) {
    console.error('Error generating test cases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port ${PORT}");
});
