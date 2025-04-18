const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const { generateAll } = require('./controllers/testGenController');

const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' });

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
