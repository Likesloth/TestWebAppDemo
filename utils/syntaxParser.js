// backend/utils/syntaxParser.js
const { parseXMLFile } = require('./xmlParser');

function collectSyntaxEntries(target, defs, { fallbackName = '', fallbackType = '' } = {}) {
  if (!target || !target.Syntax) return;

  const syntaxes = Array.isArray(target.Syntax)
    ? target.Syntax
    : [target.Syntax];

  syntaxes.forEach(syn => {
    if (!syn) return;
    const attrs = syn.$ || {};
    const pattern = attrs.Pattern ?? syn.Pattern;
    if (!pattern) return;

    defs.push({
      name: fallbackName,
      description: fallbackName,
      pattern,
      type: attrs.Type ?? fallbackType ?? '',
      length: attrs.Length ?? ''
    });
  });
}

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
    if (!input) return;
    collectSyntaxEntries(input, defs, {
      fallbackName: input.Varname,
      fallbackType: input.DataType ?? ''
    });
  });

  if (usecase.Output) {
    collectSyntaxEntries(usecase.Output, defs, {
      fallbackName: usecase.Output.Varname || 'Output',
      fallbackType: usecase.Output.DataType ?? ''
    });
  }

  return defs;
}

module.exports = { processSyntaxDefs };
