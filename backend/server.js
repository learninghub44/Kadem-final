require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// ── Startup env validation ────────────────────────────────────
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET',
  'PAYSTACK_SECRET_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('FATAL: Missing env vars:', missing.join(', '));
  process.exit(1);
}

const app = express();

// Trust Render proxy
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
}));

// ── CORS — strict origin matching ────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (!allowedOrigins.length) allowedOrigins.push('http://localhost:3000');

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    console.warn('CORS blocked origin:', origin);
    cb(new Error('CORS: Not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing with size limits ─────────────────────────────
// Captures the raw body buffer (needed to verify the Paystack webhook
// signature, which is computed over the raw unparsed payload).
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP Parameter Pollution protection ───────────────────────
app.use(hpp());

// ── Input sanitization — strip $ and . from keys (NoSQL injection) ──
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(key => {
      if (/[$.]/.test(key)) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    });
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// ── Rate limiters ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/health',
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5, // 5 payment attempts per minute
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many payment requests. Please wait a moment.' },
});

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100, // Paystack webhook retries
  standardHeaders: true, legacyHeaders: false,
});

app.use('/api/', globalLimiter);
app.use('/api/payments/activate', paymentLimiter);
app.use('/api/payments/buy-package', paymentLimiter);
app.use('/api/payments/deposit', paymentLimiter);
app.use('/api/payments/callback', callbackLimiter);

// ── Webhook signature verification for Paystack callback ─────
// Paystack signs every webhook with HMAC-SHA512 of the raw body,
// using your secret key, sent in the x-paystack-signature header.
app.use('/api/payments/callback', (req, res, next) => {
  const { verifyWebhookSignature } = require('./paystack');
  const signature = req.headers['x-paystack-signature'];
  if (!signature || !req.rawBody || !verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('[Webhook] Invalid Paystack signature from:', req.ip);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', require('./routes-auth'));
app.use('/api/payments', require('./payments'));
app.use('/api/tasks', require('./tasks'));
app.use('/api/user', require('./user'));
app.use('/api/admin', require('./admin'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ error: 'CORS policy blocked this request' });
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Kadem API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
module.exports = app;
