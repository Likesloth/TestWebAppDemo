// backend/utils/syntaxTestGenerator.js
const RandExp = require('randexp');

const SYMBOLS   = ['!', '@', '#', '$', '%', '^', '&', '*'];
const ALPHANUM  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomChar() {
  return ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
}
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function generateSyntaxTests(defs) {
  return defs.map(def => {
    let valid;

    if (def.name === 'Date') {
      // choose a year between 2000–2003
      const year = 2000 + Math.floor(Math.random() * 101);
      // all month abbreviations
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      // pick one at random
      const month = randomItem(months);
      // days in each month (Feb depends on leap year)
      const monthDays = {
        Jan:31, Feb: isLeapYear(year) ? 29 : 28, Mar:31, Apr:30,
        May:31, Jun:30, Jul:31, Aug:31, Sep:30, Oct:31,
        Nov:30, Dec:31
      };
      // pick a day within that month
      const day = String(Math.floor(Math.random() * monthDays[month]) + 1).padStart(2,'0');
      valid = `${day}${month}${year}`;
    }
    else {
      // for everything else, use the regex
      valid = new RandExp(def.pattern).gen();
    }

    const invalidValue = valid + randomItem(SYMBOLS);
    const addPos        = Math.floor(Math.random() * (valid.length + 1));
    const invalidAddition =
      valid.slice(0, addPos) + randomItem(SYMBOLS) + valid.slice(addPos);
    const omitPos       = Math.floor(Math.random() * valid.length);
    const invalidOmission =
      valid.slice(0, omitPos) + valid.slice(omitPos + 1);
    const subPos        = Math.floor(Math.random() * valid.length);
    const invalidSubstitution =
      valid.slice(0, subPos) + randomChar() + valid.slice(subPos + 1);

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
