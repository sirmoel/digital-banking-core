const Customer = require('../models/Customer');
const Account = require('../models/Account');
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

exports.create = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.customerId).select('+kycID');
    if (!customer || !customer.verified) {
      return res.status(403).json({ message: 'Complete and verify onboarding first' });
    }

    const existing = await Account.findOne({ customer: customer.id });
    if (existing) {
      return res.status(409).json({ message: 'Customer already has an account', account: existing });
    }

    // Re-validate identity immediately before remote account creation as required by the flow.
    const verified = await validateCustomerIdentity(customer);

    let data;
    let recovered = false;

    try {
      data = await nibss.createAccount({
        kycType: customer.kycType,
        kycID: customer.kycID,
        dob: verified.dob
      });
    } catch (e) {

      
      const duplicate = e.status === 409 || /already linked to an account/i.test(e.message || '');
      if (!duplicate) throw e;

      const allAccounts = await nibss.accounts();
      const list = Array.isArray(allAccounts)
        ? allAccounts
        : allAccounts?.data?.accounts || allAccounts?.accounts || allAccounts?.data || [];

      const remoteMatch = list.find(item => {
        const candidate = item?.account || item;
        return String(candidate?.kycID || candidate?.kycId || candidate?.bvn || candidate?.nin || '') === String(customer.kycID);
      });

      if (!remoteMatch) {
        const recoveryError = new Error('NIBSS says this KYC is already linked to an account, but the account could not be recovered from /api/accounts');
        recoveryError.status = 502;
        recoveryError.details = { duplicateMessage: e.message, accountsResponse: allAccounts };
        throw recoveryError;
      }

      data = remoteMatch?.account || remoteMatch;
      recovered = true;
    }

    const remote = data?.data?.account || data?.data || data?.account || data;

    if (!remote?.accountNumber) {
      const error = new Error('NIBSS response did not include accountNumber');
      error.status = 502;
      error.details = data;
      throw error;
    }

    let currentBalance = Number.isFinite(Number(remote.balance))
      ? Number(remote.balance)
      : 15000;

    // When recovering an account, I want to ask NIBSS for the authoritative current
    // balance instead of assuming the original ₦15,000 opening balance.
    if (recovered) {
      try {
        const balanceResponse = await nibss.balance(remote.accountNumber);
        const balanceData = balanceResponse?.data || balanceResponse;
        const remoteBalance = Number(balanceData?.balance);
        if (Number.isFinite(remoteBalance)) currentBalance = remoteBalance;
      } catch (_) {
        // Keep the known default if the recovery balance lookup is unavailable.
      }
    }

    const account = await Account.create({
      customer: customer.id,
      accountNumber: remote.accountNumber,
      accountName: remote.accountName || `${customer.firstName} ${customer.lastName}`,
      bankCode: remote.bankCode,
      bankName: remote.bankName,
      fintechId: remote.fintechId,
      kycType: customer.kycType,
      kycID: customer.kycID,
      openingBalance: currentBalance
    });

    res.status(recovered ? 200 : 201).json({
      message: recovered ? 'Existing NIBSS account recovered successfully' : 'Account created',
      account
    });
  } catch (e) {
    next(e);
  }
};

exports.mine = async (req, res, next) => {
  try {
    const account = await Account.findOne({ customer: req.user.customerId });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ account });
  } catch (e) {
    next(e);
  }
};

exports.balance = async (req, res, next) => {
  try {
    const account = await Account.findOne({ customer: req.user.customerId });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(await nibss.balance(account.accountNumber));
  } catch (e) {
    next(e);
  }
};

exports.nameEnquiry = async (req, res, next) => {
  try {
    res.json(await nibss.nameEnquiry(req.params.accountNumber));
  } catch (e) {
    next(e);
  }
};
