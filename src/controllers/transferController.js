const Account = require('../models/Account');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const nibss = require('../services/nibssService');

async function validateCustomerIdentity(customer) {
  const verified = customer.kycType === 'bvn'
    ? await nibss.validateBvn({ bvn: customer.kycID })
    : await nibss.validateNin({ nin: customer.kycID });

  if (!verified || verified.valid === false || !verified.firstName || !verified.lastName || !verified.dob) {
    const error = new Error(`${customer.kycType.toUpperCase()} verification failed`);
    error.status = 400;
    throw error;
  }

  return verified;
}

exports.transfer = async (req, res, next) => {
  try {
    const { to, amount } = req.body;
    const value = Number(amount);
    if (typeof to !== 'string' || !/^\d{10}$/.test(to) || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ message: 'to must be a 10-digit account number and amount must be positive' });
    }

    const sender = await Account.findOne({ customer: req.user.customerId });
    if (!sender) return res.status(404).json({ message: 'Sender account not found' });

    const customer = await Customer.findById(req.user.customerId).select('+kycID');
    if (!customer || !customer.verified) {
      return res.status(403).json({ message: 'Customer identity is not verified' });
    }

    // Required pre-transfer checks: identity validation followed by recipient name enquiry.
    await validateCustomerIdentity(customer);
    const recipient = await nibss.nameEnquiry(to);
    if (!recipient.accountName) {
      return res.status(400).json({ message: 'Recipient name could not be verified' });
    }

    const result = await nibss.transfer({
      from: sender.accountNumber,
      to,
      amount: String(value)
    });

    const transactionId = result.transactionId || result.reference || result.transactionReference || result.id;
    if (!transactionId) {
      return res.status(502).json({ message: 'NIBSS did not return a transaction identifier', result });
    }

    const record = await Transaction.create({
      customer: req.user.customerId,
      transactionId,
      from: sender.accountNumber,
      to,
      amount: Number(result.amount ?? value),
      status: result.status || 'PENDING',
      direction: 'debit',
      response: result
    });

    res.status(200).json({ message: 'Transfer request submitted', recipient, transaction: record });
  } catch (e) {
    next(e);
  }
};

exports.status = async (req, res, next) => {
  try {
    let record = await Transaction.findOne({
      transactionId: req.params.transactionId,
      customer: req.user.customerId
    });

    // Recovery path: the remote transfer may have succeeded while the local
    // response/database write failed (for example, because the internet dropped).
    // Query NIBSS first so a successful remote transaction can be synchronized locally.
    const latest = await nibss.transaction(req.params.transactionId);
    const remoteTransactionId = latest.transactionId || latest.reference || latest.transactionReference || latest.id;

    if (!record) {
      const sender = await Account.findOne({ customer: req.user.customerId });
      if (!sender) return res.status(404).json({ message: 'Sender account not found' });

      const remoteSender = latest.from || latest.senderAccount;
      const remoteRecipient = latest.to || latest.receiverAccount;
      if (!remoteTransactionId || !remoteSender || remoteSender !== sender.accountNumber) {
        return res.status(404).json({ message: 'Transaction not found for this customer' });
      }

      record = await Transaction.create({
        customer: req.user.customerId,
        transactionId: remoteTransactionId,
        from: remoteSender,
        to: remoteRecipient || 'UNKNOWN',
        amount: Number(latest.amount || 0),
        status: latest.status || 'PENDING',
        direction: 'debit',
        response: latest
      });
    } else {
      record.status = latest.status || record.status;
      record.response = latest;
      await record.save();
    }

    res.json(latest);
  } catch (e) {
    next(e);
  }
};

exports.history = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [transactions, total] = await Promise.all([
      Transaction.find({ customer: req.user.customerId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments({ customer: req.user.customerId })
    ]);
    res.json({ page, limit, total, transactions });
  } catch (e) {
    next(e);
  }
};
