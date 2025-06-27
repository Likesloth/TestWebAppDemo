// backend/utils/syntaxParser.js
const { parseXMLFile } = require('./xmlParser');

async function processSyntaxDefs(dataDictionaryPath) {
  const data = await parseXMLFile(dataDictionaryPath);

  if (!data.UC || !data.UC.Usecase) {
    return [];
  }

  const usecase = Array.isArray(data.UC.Usecase)
    ? data.UC.Usecase[0]
    : data.UC.Usecase;

  const inputs = Array.isArray(usecase.Input)
    ? usecase.Input
    : [usecase.Input];

  const defs = [];

  inputs.forEach(input => {
    if (!input.Syntax) return;

    const s = input.Syntax;

    defs.push({
      name:        input.Varname,
      description: input.Varname,          // or any other description you prefer
      pattern:     s.Pattern,
      type:        s.Type,
      length:      s.Length
    });
  });

  return defs;
}

module.exports = { processSyntaxDefs };
