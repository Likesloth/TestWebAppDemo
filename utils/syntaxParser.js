// backend/utils/syntaxParser.js
const { parseXMLFile } = require('./xmlParser');

/**
 * Extracts <Syntax> definitions from a Data Dictionary XML
 * (inputXml can be a String path or Buffer).
 *
 * @param {string|Buffer} inputXml
 * @returns {Promise<Array<{name:string,description:string,pattern:string,type:string,length:string}>>}
 */
async function processSyntaxDefs(inputXml) {
  const data = await parseXMLFile(inputXml);
  if (!data.UC || !data.UC.Usecase) return [];

  const usecase = Array.isArray(data.UC.Usecase)
    ? data.UC.Usecase[0]
    : data.UC.Usecase;

  const inputs = Array.isArray(usecase.Input)
    ? usecase.Input
    : [usecase.Input];

  const defs = [];

  inputs.forEach(input => {
    if (!input.Syntax) return;
    const syntaxes = Array.isArray(input.Syntax)
      ? input.Syntax
      : [input.Syntax];

    syntaxes.forEach(syn => {
      // Pattern may live on syn.$ or directly as syn.Pattern
      const pattern = syn.$?.Pattern ?? syn.Pattern;
      defs.push({
        name:        input.Varname,
        description: input.Varname,
        pattern,
        type:        syn.$?.Type ?? input.DataType ?? '',
        length:      syn.$?.Length ?? ''
      });
    });
  });

  return defs;
}

module.exports = { processSyntaxDefs };
