const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return res.status(401).json({ message: 'Bearer token required' });
  try {
    req.user = jwt.verify(value.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
