const router = require('express').Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const account = require('../controllers/accountController');
const transfers = require('../controllers/transferController');

router.post('/customers/register', authController.register);
router.post('/customers/login', authController.login);
router.post('/account/create', auth, account.create);
router.get('/account/me', auth, account.mine);
router.get('/account/balance', auth, account.balance);
router.get('/account/name-enquiry/:accountNumber', auth, account.nameEnquiry);
router.post('/transfer', auth, transfers.transfer);
router.get('/transaction/:transactionId', auth, transfers.status);
router.get('/transactions', auth, transfers.history);

module.exports = router;
