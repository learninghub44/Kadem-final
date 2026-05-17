const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const supabase = require('./supabase');

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { full_name, phone, email, password, referral_code: referred_by } = req.body;

    // Validate inputs
    if (!full_name || !phone || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!/^(07|01)\d{8}$/.test(phone.trim()))
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number e.g. 0712345678' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return res.status(400).json({ error: 'Enter a valid email address' });

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    // Check existing email
    const { data: emailExists } = await supabase
      .from('users').select('id').eq('email', cleanEmail).maybeSingle();
    if (emailExists) return res.status(409).json({ error: 'Email already registered' });

    // Check existing phone
    const { data: phoneExists } = await supabase
      .from('users').select('id').eq('phone', cleanPhone).maybeSingle();
    if (phoneExists) return res.status(409).json({ error: 'Phone number already registered' });

    // Validate referral code if provided
    let referrerData = null;
    if (referred_by) {
      const { data: referrer } = await supabase
        .from('users').select('id, full_name, wallet_balance')
        .eq('referral_code', referred_by.toUpperCase().trim())
        .maybeSingle();
      if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
      referrerData = referrer;
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Generate unique referral code
    let referral_code, codeExists = true;
    while (codeExists) {
      referral_code = generateReferralCode();
      const { data } = await supabase.from('users').select('id').eq('referral_code', referral_code).maybeSingle();
      codeExists = !!data;
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name: full_name.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        password_hash,
        referral_code,
        referred_by: referrerData ? referred_by.toUpperCase().trim() : null,
      })
      .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code')
      .single();

    if (error) {
      console.error('Register insert error:', error);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }

    // Grant referral registration bonus
    if (referrerData) {
      const bonus = Number(process.env.REFERRAL_REGISTRATION_BONUS || 50);
      await supabase.from('users')
        .update({ wallet_balance: Number(referrerData.wallet_balance) + bonus })
        .eq('id', referrerData.id);
      await supabase.from('referral_earnings').insert({
        referrer_id: referrerData.id, referred_id: user.id, event: 'registration', amount: bonus,
      });
      await supabase.from('transactions').insert({
        user_id: referrerData.id, type: 'referral', amount: bonus, status: 'completed',
        description: `Referral bonus — ${user.full_name} registered`,
      });
    }

    const token = signToken(user.id);
    res.status(201).json({ message: 'Registration successful', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, password_hash, status, wallet_balance, package_level, role, referral_code')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    // Always compare to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashfortimingprotectiononly000000000000000000000';
    const valid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (error || !user || !valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'suspended')
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });

    const { password_hash, ...safeUser } = user;
    const token = signToken(user.id);
    res.json({ message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code')
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error || !user) return res.status(401).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
