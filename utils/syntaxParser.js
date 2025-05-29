// backend/utils/syntaxParser.js
const { parseXMLFile } = require('./xmlParser');

async function processSyntaxDefs(dataDictionaryPath) {
  const data = await parseXMLFile(dataDictionaryPath);
  const raw = data.UC?.Syntax?.Condition;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(c => ({
    name:        c.$.name,
    description: c.$.description,
    pattern:     c.$.pattern,
    type:        c.$.type,
    length:      c.$.length
  }));
}

module.exports = { processSyntaxDefs };
