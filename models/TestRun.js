// models/TestRun.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PartitionSchema = new Schema({
  name:  String,
  items: [{
    id:     String,
    label:  String,
    sample: Schema.Types.Mixed
  }]
}, { _id: false });

const SyntaxSchema = new Schema({
  name:        String,
  description: String,
  regex:       String,
  type:        String,
  length:      String,
  testCases: {
    valid:              String,
    invalidValue:       String,
    invalidSubstitution: String,
    invalidOmission:    String,
    invalidAddition:    String
  }
}, { _id: false });

const StateTestSchema = new Schema({
  testCaseID:    String,
  startState:    String,
  event:         String,
  expectedState: Schema.Types.Mixed,
  type:          { type: String, enum: ['Valid','Invalid'], required: true }
}, { _id: false });

const TestCaseSchema = new Schema({
  testCaseID: { type: String, required: true },
  inputs:     { type: Map, of: Schema.Types.Mixed, required: true },
  expected:   { type: Map, of: Schema.Types.Mixed, required: true }
}, { _id: false });

const TestRunSchema = new Schema({
  user:                   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:              { type: Date, default: Date.now },
  dataDictionaryFilename: String,
  decisionTreeFilename:   String,
  partitions:             [PartitionSchema],
  testCases:              [TestCaseSchema],
  syntaxResults:          [SyntaxSchema],

  // make stateTests optional, default to empty array
  stateTests: {
    type:    [StateTestSchema],
    required: false,
    default: []
  },

  ecpCsvData:      { type: String, required: true },
  syntaxCsvData:   { type: String, required: true },

  // make stateCsvData optional with default empty string
  stateCsvData:    { type: String, required: false, default: '' },

  combinedCsvData: { type: String, required: true }
});

module.exports = mongoose.model('TestRun', TestRunSchema);
