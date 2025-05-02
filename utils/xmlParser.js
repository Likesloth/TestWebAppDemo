const fs = require('fs');
const xml2js = require('xml2js');

const parseXMLFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({ explicitArray: false });
    fs.readFile(filePath, (err, data) => {
      if (err) return reject(err);
      parser.parseString(data, (err, result) => {
        if (err) return reject(err);
        resolve(result);
        // console.log(result);
      });
    });
  });
};

module.exports = { parseXMLFile };
