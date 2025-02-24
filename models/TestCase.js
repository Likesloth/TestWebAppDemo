// models/TestCase.js
const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  testCaseID: { type: String, required: true },
  orderPrice: { type: Number, required: true },
  customerType: { type: String, required: true },
  expectedDiscount: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestCase', testCaseSchema);
