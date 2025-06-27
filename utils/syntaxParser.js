// backend/utils/syntaxParser.js
const { parseXMLFile } = require('./xmlParser');

async function processSyntaxDefs(dataDictionaryPath) {
  const data = await parseXMLFile(dataDictionaryPath);
  if (!data.UC || !data.UC.Usecase) return [];

  const usecase = Array.isArray(data.UC.Usecase)
    ? data.UC.Usecase[0]
    : data.UC.Usecase;

  const inputs = Array.isArray(usecase.Input)
    ? usecase.Input
    : [usecase.Input];

  const defs = [];

  inputs.forEach(input => {
    // look for a child <Syntax Pattern="…"/>
    if (!input.Syntax) return;
    const syntaxes = Array.isArray(input.Syntax)
      ? input.Syntax
      : [input.Syntax];

    syntaxes.forEach(syn => {
      // syn may be either { $: { Pattern: "…"} } or syn.Pattern
      const pattern  = syn.$?.Pattern ?? syn.Pattern;
      defs.push({
        name:        input.Varname,
        description: input.Varname,
        pattern,
        // you can pull type/length from DataType/Length if you want
        type:        syn.$?.Type ?? input.DataType,
        length:      syn.$?.Length ?? ''
      });
    });
  });

  return defs;
}

module.exports = { processSyntaxDefs };
