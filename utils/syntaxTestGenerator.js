// backend/utils/syntaxTestGenerator.js
const RandExp = require('randexp');

function generateSyntaxTests(defs) {
  return defs.map(d => {
    const valid = new RandExp(d.pattern).gen();
    return {
      name:        d.name,
      description: d.description,
      regex:       d.pattern,
      type:        d.type,
      length:      d.length,
      testCases: {
        valid,
        invalidValue:        valid + 'X',
        invalidOmission:     valid.slice(1),
        invalidAddition:     '!' + valid + '#',
        invalidSubstitution: valid[0] + '-' + valid.slice(2)
      }
    };
  });
}

module.exports = { generateSyntaxTests };
