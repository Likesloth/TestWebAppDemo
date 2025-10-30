// backend/utils/xmlValidator.js
const { parseXMLFile } = require('./xmlParser');

module.exports = async function validateUploadedXml(req, res, next) {
  // grab Multer’s uploaded file objects
  // Normalize files: Multer puts files in an array for .any(), or an object for .fields()
  const filesArray = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();

  // Helper to find a file by field name (supports both shapes)
  const findByField = (name) => {
    if (!name) return undefined;
    if (Array.isArray(req.files)) return filesArray.find(f => f.fieldname === name);
    return req.files?.[name]?.[0];
  };

  // Accept new and legacy field names for Data Dictionary; if none, fallback to single uploaded file
  let ddFile = findByField('dataDictionary') || findByField('usecasedatadic') || findByField('useCaseDataDic');
  if (!ddFile && filesArray.length === 1) {
    ddFile = filesArray[0];
  }

  const dtFile = findByField('decisionTree');
  const smFile = findByField('stateMachine'); // optional

  // Require Data Dictionary (either named field or single file); Decision Tree is optional
  if (!ddFile) {
    console.warn('[Validator] Missing Data Dictionary upload');
    return res
      .status(400)
      .json({
        success: false,
        error: 'Data Dictionary XML file is required.'
      });
  }

  // 1) Validate the Data Dictionary XML (from in-memory buffer)
  try {
    await parseXMLFile(ddFile.buffer);
    console.log(`[Validator] ✅ Parsed DataDictionary XML: ${ddFile.originalname}`);
  } catch (err) {
    console.error(
      `[Validator] ❌ DataDictionary parse error (${ddFile.originalname}): ${err.message}`
    );
    return res
      .status(400)
      .json({
        success: false,
        error: `Invalid Data Dictionary XML (${ddFile.originalname}): ${err.message}`
      });
  }

  // 2) Optional: Validate the Decision Tree XML if provided
  if (dtFile && dtFile.buffer) {
    try {
      await parseXMLFile(dtFile.buffer);
      console.log(`[Validator] ✅ Parsed DecisionTree XML: ${dtFile.originalname}`);
    } catch (err) {
      console.error(
        `[Validator] ❌ DecisionTree parse error (${dtFile?.originalname || 'unknown'}): ${err.message}`
      );
      return res
        .status(400)
        .json({
          success: false,
          error: `Invalid Decision Tree XML (${dtFile?.originalname || 'unknown'}): ${err.message}`
        });
    }
  }

  // 3) Optional: Validate State Machine XML if provided
  if (smFile && smFile.buffer) {
    try {
      await parseXMLFile(smFile.buffer);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `Invalid State Machine XML (${smFile.originalname}): ${err.message}`
      });
    }
  }

  // all uploads are well-formed XML; proceed
  next();
};
