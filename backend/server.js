require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Validate required env vars at startup
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'PAYHERO_BASIC_AUTH', 'PAYHERO_CHANNEL_ID', 'PAYHERO_CALLBACK_URL'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('FATAL: Missing env vars:', missing.join(', '));
  process.exit(1);
}

const app = express();

// Trust Render's proxy (fixes express-rate-limit X-Forwarded-For warning)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - strict in production
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL.replace(/\/$/, '')]
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: Not allowed'));
  },
  credentials: true,
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' })); // 10mb for base64 photo uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// Routes
app.use('/api/auth', require('./routes-auth'));
app.use('/api/payments', require('./payments'));
app.use('/api/tasks', require('./tasks'));
app.use('/api/user', require('./user'));
app.use('/api/admin', require('./admin'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.message?.includes('CORS')) return res.status(403).json({ error: 'CORS error' });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Kadem API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
module.exports = app;
