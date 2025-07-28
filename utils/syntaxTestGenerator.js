// backend/utils/syntaxTestGenerator.js
const RandExp = require('randexp');

// Build symbol list from ASCII ranges:
// 33–47  =>  ! " # $ % & ' ( ) * + , - . /
// 58–64  =>  : ; < = > ? @
// 91–96  =>  [ \ ] ^ _ `
// 123–126=>  { | } ~
const SYMBOL_RANGES = [
  [33, 47],
  [58, 64],
  [91, 96],
  [123, 126]
];
const SYMBOLS = SYMBOL_RANGES.flatMap(([start, end]) => {
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(String.fromCharCode(i));
  }
  return arr;
});

// Build alphanumeric list from ASCII codes:
// 48–57   =>  0–9
// 65–90   =>  A–Z
// 97–122  =>  a–z
const ALPHANUM = [];
for (let i = 48; i <= 57; i++) {
  ALPHANUM.push(String.fromCharCode(i));
}
for (let i = 65; i <= 90; i++) {
  ALPHANUM.push(String.fromCharCode(i));
}
for (let i = 97; i <= 122; i++) {
  ALPHANUM.push(String.fromCharCode(i));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomChar() {
  return randomItem(ALPHANUM);
}
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function generateSyntaxTests(defs) {
  return defs.map(def => {
    let valid;

    if (def.name === 'Date') {
      // custom date logic…
      const year = 2000 + Math.floor(Math.random() * 101);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const month = randomItem(months);
      const monthDays = {
        Jan:31, Feb: isLeapYear(year) ? 29 : 28, Mar:31, Apr:30,
        May:31, Jun:30, Jul:31, Aug:31, Sep:30, Oct:31,
        Nov:30, Dec:31
      };
      const day = String(Math.floor(Math.random() * monthDays[month]) + 1).padStart(2,'0');
      valid = `${day}${month}${year}`;
    } else {
      valid = new RandExp(def.pattern).gen();
    }

    const invalidValue = valid + randomItem(SYMBOLS);
    const addPos = Math.floor(Math.random() * (valid.length + 1));
    const invalidAddition =
      valid.slice(0, addPos) + randomItem(SYMBOLS) + valid.slice(addPos);
    const omitPos = Math.floor(Math.random() * valid.length);
    const invalidOmission =
      valid.slice(0, omitPos) + valid.slice(omitPos + 1);
    const subPos = Math.floor(Math.random() * valid.length);
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
