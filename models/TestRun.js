// backend/models/TestRun.js
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

const TestCaseSchema = new Schema({
  testCaseID:       String,
  orderPrice:       Number,
  customerType:     String,
  expectedDiscount: String
}, { _id: false });

const TestRunSchema = new Schema({
  user:                 { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:            { type: Date, default: Date.now },
  dataDictionaryFilename: String,
  decisionTreeFilename: String,
  partitions:           [PartitionSchema],
  testCases:            [TestCaseSchema],
  csvFilename:          { type: String, required: true }   // store just the filename
});

module.exports = mongoose.model('TestRun', TestRunSchema);
