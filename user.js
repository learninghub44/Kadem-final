const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/user/wallet — wallet balance + transaction history
router.get('/wallet', async (req, res) => {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      wallet_balance: req.user.wallet_balance,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// GET /api/user/referrals
router.get('/referrals', async (req, res) => {
  try {
    const { data: referrals, error } = await supabase
      .from('users')
      .select('id, full_name, status, package_level, created_at')
      .eq('referred_by', req.user.referral_code)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: earnings } = await supabase
      .from('referral_earnings')
      .select('event, amount, created_at')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });

    const totalEarned = (earnings || []).reduce((a, b) => a + Number(b.amount), 0);

    res.json({
      referral_code: req.user.referral_code,
      referrals,
      earnings,
      total_earned: totalEarned,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// GET /api/user/withdrawals
router.get('/withdrawals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.json({ withdrawals: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// GET /api/user/profile
router.get('/profile', (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/user/profile
router.patch('/profile', async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone) updates.phone = phone;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, full_name, phone, email, status, wallet_balance, package_level, referral_code')
      .single();

    if (error) throw error;
    res.json({ message: 'Profile updated', user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
