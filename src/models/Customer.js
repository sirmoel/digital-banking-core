const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  kycType: { type: String, enum: ['bvn', 'nin'], required: true },
  // Store test KYC identifiers only. For real banking, use approved encryption/tokenization and controls.
  kycID: { type: String, required: true, unique: true, select: false },
  dob: { type: String, required: true },
  phone: String,
  verified: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Customer', schema);
