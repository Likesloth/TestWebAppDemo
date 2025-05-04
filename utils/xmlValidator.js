// backend/utils/xmlValidator.js
const { parseXMLFile } = require('./xmlParser');

module.exports = async function validateUploadedXml(req, res, next) {
  // grab Multer’s uploaded file objects
  const ddFile = req.files.dataDictionary?.[0];
  const dtFile = req.files.decisionTree  ?. [0];

  if (!ddFile || !dtFile) {
    console.warn('[Validator] Missing one or both XML uploads');
    return res
      .status(400)
      .json({
        success: false,
        error: 'Both Data Dictionary and Decision Tree XML files are required.'
      });
  }

  // 1) Validate the Data Dictionary XML
  try {
    await parseXMLFile(ddFile.path);
    console.log(`[Validator] ✅ Parsed DataDictionary XML: ${ddFile.originalname}`);
  } catch (err) {
    console.error(`[Validator] ❌ DataDictionary parse error (${ddFile.originalname}): ${err.message}`);
    return res
      .status(400)
      .json({
        success: false,
        error: `Invalid Data Dictionary XML (${ddFile.originalname}): ${err.message}`
      });
  }

  // 2) Validate the Decision Tree XML
  try {
    await parseXMLFile(dtFile.path);
    console.log(`[Validator] ✅ Parsed DecisionTree XML: ${dtFile.originalname}`);
  } catch (err) {
    console.error(`[Validator] ❌ DecisionTree parse error (${dtFile.originalname}): ${err.message}`);
    return res
      .status(400)
      .json({
        success: false,
        error: `Invalid Decision Tree XML (${dtFile.originalname}): ${err.message}`
      });
  }

  // if both parsed successfully, move on
  next();
};
