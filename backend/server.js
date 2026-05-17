require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes-auth'));
app.use('/api/payments', require('./payments'));
app.use('/api/tasks', require('./tasks'));
app.use('/api/user', require('./user'));
app.use('/api/admin', require('./admin'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Kadem API running on port ${PORT}`));
module.exports = app;
