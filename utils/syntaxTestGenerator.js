// backend/utils/syntaxTestGenerator.js
const RandExp = require('randexp');

const SYMBOLS = ['!', '@', '#', '$', '%', '^', '&', '*'];
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomChar() {
  return ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
}

function generateSyntaxTests(defs) {
  return defs.map(def => {
    const valid = new RandExp(def.pattern).gen();

    // 1) invalidValue: append a random symbol
    const invalidValue = valid + randomItem(SYMBOLS);

    // 2) invalidAddition: insert one random symbol at a random index
    const addPos = Math.floor(Math.random() * (valid.length + 1));
    const invalidAddition =
      valid.slice(0, addPos) +
      randomItem(SYMBOLS) +
      valid.slice(addPos);

    // 3) invalidOmission: remove one character at a random index
    const omitPos = Math.floor(Math.random() * valid.length);
    const invalidOmission =
      valid.slice(0, omitPos) +
      valid.slice(omitPos + 1);

    // 4) invalidSubstitution: replace one character at random with an alphanumeric
    const subPos = Math.floor(Math.random() * valid.length);
    const invalidSubstitution =
      valid.slice(0, subPos) +
      randomChar() +
      valid.slice(subPos + 1);

    return {
      name:        def.name,
      description: def.description,
      regex:       def.pattern,
      type:        def.type,
      length:      def.length,
      testCases: {
        valid,
        invalidValue,
        invalidSubstitution,
        invalidOmission,
        invalidAddition
      }
    };
  });
}

module.exports = { generateSyntaxTests };
