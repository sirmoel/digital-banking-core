const client = require('../config/nibss');
let token = null;
let expiresAt = 0;

async function getToken(force = false) {
  if (!force && token && Date.now() < expiresAt - 60000) return token;
  const { data } = await client.post('/api/auth/token', {
    apiKey: process.env.NIBSS_API_KEY,
    apiSecret: process.env.NIBSS_API_SECRET
  });
  if (!data || !data.token) throw new Error('NIBSS login response did not contain a token');
  token = data.token;
  // Documentation specifies a 1-hour JWT lifetime. Refresh slightly early.
  expiresAt = Date.now() + 59 * 60 * 1000;
  return token;
}
async function request(method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const jwt = await getToken(attempt > 0);
    try {
      const response = await client.request({
        method, url: path, data: body,
        headers: { Authorization: `Bearer ${jwt}` }
      });
      return response.data;
    } catch (err) {
      if (err.response?.status === 401 && attempt === 0) {
        token = null; expiresAt = 0; continue;
      }
      const e = new Error(err.response?.data?.message || err.message || 'NIBSS request failed');
      e.status = err.response?.status || 502;
      e.details = err.response?.data;
      throw e;
    }
  }
}
module.exports = {
  createBvn: body => request('post', '/api/insertBvn', body),
  createNin: body => request('post', '/api/insertNin', body),
  validateBvn: async body => {
    const response = await request('post', '/api/validateBvn', body);
    return response?.data || response;
  },
  validateNin: async body => {
    const response = await request('post', '/api/validateNin', body);
    return response?.data || response;
  },
  createAccount: body => request('post', '/api/account/create', body),
  nameEnquiry: account => request('get', `/api/account/name-enquiry/${encodeURIComponent(account)}`),
  accounts: () => request('get', '/api/accounts'),
  balance: account => request('get', `/api/account/balance/${encodeURIComponent(account)}`),
  transfer: body => request('post', '/api/transfer', body),
  transaction: id => request('get', `/api/transaction/${encodeURIComponent(id)}`)
};
