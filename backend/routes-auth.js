const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('./supabase');

const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, phone, email, password, referral_code: referred_by } = req.body;
    if (!full_name || !phone || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: existing } = await supabase
      .from('users').select('id').or(`email.eq.${email},phone.eq.${phone}`).single();
    if (existing) return res.status(409).json({ error: 'Email or phone already registered' });

    if (referred_by) {
      const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', referred_by).single();
      if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const referral_code = generateReferralCode();

    const { data: user, error } = await supabase.from('users').insert({
      full_name, phone, email, password_hash, referral_code,
      referred_by: referred_by || null,
    }).select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code').single();

    if (error) throw error;

    // Referral registration bonus
    if (referred_by) {
      const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', referred_by).single();
      if (referrer) {
        const bonus = Number(process.env.REFERRAL_REGISTRATION_BONUS || 50);
        await supabase.from('users').update({ wallet_balance: referrer.wallet_balance + bonus }).eq('id', referrer.id);
        await supabase.from('referral_earnings').insert({ referrer_id: referrer.id, referred_id: user.id, event: 'registration', amount: bonus });
        await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus - ${user.full_name} registered` });
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Registration successful', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, password_hash, status, wallet_balance, package_level, role, referral_code')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });

    const { password_hash, ...safeUser } = user;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(401).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
