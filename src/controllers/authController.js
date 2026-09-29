const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const nibss = require('../services/nibssService');

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function identityMatches(submitted, verified) {
  const submittedDob = normalizeDate(submitted.dob);
  const verifiedDob = normalizeDate(verified.dob);
  if (!submittedDob || !verifiedDob) return false;

  return (
    String(submitted.firstName).trim().toLowerCase() === String(verified.firstName || '').trim().toLowerCase() &&
    String(submitted.lastName).trim().toLowerCase() === String(verified.lastName || '').trim().toLowerCase() &&
    submittedDob.toISOString().slice(0, 10) === verifiedDob.toISOString().slice(0, 10)
  );
}

exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, kycType, kycID, dob, phone } = req.body;

    if (![firstName, lastName, email, password, kycType, kycID, dob].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ message: 'firstName, lastName, email, password, kycType, kycID and dob are required' });
    }

    const type = kycType.toLowerCase();
    if (!['bvn', 'nin'].includes(type)) {
      return res.status(400).json({ message: 'kycType must be BVN or NIN' });
    }
    if (!/^\d{11}$/.test(kycID)) {
      return res.status(400).json({ message: `${type.toUpperCase()} must contain 11 digits` });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!normalizeDate(dob)) {
      return res.status(400).json({ message: 'dob must be a valid date' });
    }
    if (type === 'bvn' && !phone) {
      return res.status(400).json({ message: 'phone is required for BVN registration' });
    }

    const existing = await Customer.findOne({
      $or: [{ email: email.toLowerCase() }, { kycID }]
    });
    if (existing) {
      return res.status(409).json({ message: 'Email or KYC identifier already registered locally' });
    }

    // 
    // Validating an existing KYC record instead of trying to insert it for Customer registration.
    const verified = type === 'bvn'
      ? await nibss.validateBvn({ bvn: kycID })
      : await nibss.validateNin({ nin: kycID });

    if (!verified || verified.valid === false || !verified.firstName || !verified.lastName || !verified.dob) {
      return res.status(400).json({ message: `${type.toUpperCase()} verification failed` });
    }

    if (!identityMatches({ firstName, lastName, dob }, verified)) {
      return res.status(400).json({
        message: `${type.toUpperCase()} details do not match the supplied firstName, lastName and dob`
      });
    }

    if (type === 'bvn' && verified.phone && phone && String(verified.phone) !== String(phone)) {
      return res.status(400).json({ message: 'BVN phone number does not match the supplied phone' });
    }

    const customer = await Customer.create({
      firstName: verified.firstName,
      lastName: verified.lastName,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      kycType: type,
      kycID,
      dob: normalizeDate(verified.dob),
      phone: verified.phone || phone,
      verified: true
    });

    return res.status(201).json({
      message: 'Customer onboarded and identity verified',
      customerId: customer.id
    });
  } catch (e) {
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const customer = await Customer.findOne({ email: String(email || '').toLowerCase() }).select('+passwordHash');
    if (!customer || !(await bcrypt.compare(password || '', customer.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const accessToken = jwt.sign(
      { customerId: customer.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    res.json({
      accessToken,
      tokenType: 'Bearer',
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email
      }
    });
  } catch (e) {
    next(e);
  }
};
