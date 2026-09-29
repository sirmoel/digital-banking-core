const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  transactionId: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  status: { type: String, default: 'PENDING' },
  direction: { type: String, enum: ['debit', 'credit'], default: 'debit' },
  response: mongoose.Schema.Types.Mixed
}, { timestamps: true });
module.exports = mongoose.model('Transaction', schema);
