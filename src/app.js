const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(morgan('combined'));
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'Digital Bank API' }));
app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
});
module.exports = app;
