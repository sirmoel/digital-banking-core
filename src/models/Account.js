const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  accountNumber: { type: String, required: true, unique: true },
  accountName: { type: String, required: true },
  bankCode: String,
  bankName: String,
  fintechId: String,
  kycType: { type: String, enum: ['bvn', 'nin'], required: true },
  kycID: { type: String, required: true, select: false },
  openingBalance: { type: Number, default: 15000 }
}, { timestamps: true });
module.exports = mongoose.model('Account', schema);
