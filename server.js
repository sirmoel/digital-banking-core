require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');

const dns = require("dns");

// this fixes "querySrv ECONNREFUSED _mongodb._tcp.alabicluster0.gx1u26j.mongodb.net"
// it tells Node.js to use Google's public DNS servers

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PORT = process.env.PORT || 5000;
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => console.log(`API listening on ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
