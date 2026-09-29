const axios = require('axios');
const client = axios.create({
  baseURL: (process.env.NIBSS_BASE_URL || 'https://nibssbyphoenix.onrender.com').replace(/\/$/, ''),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});
module.exports = client;
