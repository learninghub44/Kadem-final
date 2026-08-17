require('dotenv').config();
const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { initiateSTKPush } = require('./paystack');
const { authenticate, requireActive, requireAdmin } = require('./auth');

const PACKAGES = {
  starter: { price: 100 },
  bronze:  { price: 500 },
  silver:  { price: 1500 },
  gold:    { price: 2999 },
};
const ACTIVATION_FEE = 150;

// ── POST /api/payments/activate ───────────────────────────────
router.post('/activate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.status === 'active')
      return res.status(400).json({ error: 'Account is already active' });

    const { phone } = req.body;
    const phoneToUse = phone || user.phone;
    if (!phoneToUse || !/^(07|01)\d{8}$/.test(phoneToUse.trim()))
      return res.status(400).json({ error: 'Enter a valid Kenyan M-Pesa number (07XXXXXXXX)' });

    // Prevent duplicate pending activation
    const { data: existingPending } = await supabase.from('transactions')
      .select('id, created_at').eq('user_id', user.id)
      .eq('type', 'activation').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (existingPending) {
      const age = Date.now() - new Date(existingPending.created_at).getTime();
      if (age < 5 * 60 * 1000) // 5 minutes
        return res.status(429).json({ error: 'STK push already sent. Please check your phone and enter your PIN.' });
    }

    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(phoneToUse.trim(), ACTIVATION_FEE, reference, `${user.full_name} Activation`, user.email);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'activation', amount: ACTIVATION_FEE,
      status: 'pending', paystack_reference: reference,
      description: 'Account activation fee',
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN within 30 seconds.', reference });
  } catch (err) {
    console.error('[Activate] Error:', err.message);
    const msg = err.message || '';
    if (msg.includes('Invalid') && msg.includes('key')) {
      return res.status(502).json({ error: 'Payment system configuration error. Please contact support.' });
    }
    res.status(502).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// ── POST /api/payments/buy-package ────────────────────────────
router.post('/buy-package', authenticate, requireActive, async (req, res) => {
  try {
    const { package_name } = req.body;
    const pkg = PACKAGES[package_name];
    if (!pkg) return res.status(400).json({ error: 'Invalid package name' });

    const user = req.user;
    const reference = `PKG-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, pkg.price, reference, `${package_name} Package`, user.email);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'package', amount: pkg.price,
      status: 'pending', paystack_reference: reference,
      description: `${package_name} package`,
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('[Buy Package] Error:', err.message);
    const msg = err.message || '';
    if (msg.includes('Invalid') && msg.includes('key')) {
      return res.status(502).json({ error: 'Payment system configuration error. Please contact support.' });
    }
    res.status(502).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// ── POST /api/payments/deposit ────────────────────────────────
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const amt = Number(req.body.amount);
    if (!amt || amt < 10 || amt > 150000)
      return res.status(400).json({ error: 'Amount must be between KES 10 and KES 150,000' });

    const user = req.user;
    const reference = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, amt, reference, 'Wallet Deposit', user.email);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'deposit', amount: amt,
      status: 'pending', paystack_reference: reference,
      description: 'Wallet deposit',
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('[Deposit] Error:', err.message);
    const msg = err.message || '';
    if (msg.includes('Invalid') && msg.includes('key')) {
      return res.status(502).json({ error: 'Payment system configuration error. Please contact support.' });
    }
    res.status(502).json({ error: 'Payment initiation failed. Please try again.' });
  }
});

// ── POST /api/payments/withdraw-request ──────────────────────
// USER submits request only. Admin processes it manually. No M-Pesa here.
router.post('/withdraw-request', authenticate, requireActive, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const user = req.user;
    const amt = Number(amount);

    // Validations
    // Eligibility: Silver/Gold package OR 3+ referrals
    const hasSilverGold = ['silver', 'gold'].includes(user.package_level);
    if (!hasSilverGold) {
      const { count } = await supabase
        .from('users').select('id', { count: 'exact', head: true })
        .eq('referred_by', user.referral_code);
      if ((count || 0) < 3)
        return res.status(403).json({ error: 'You need Silver/Gold package OR 3+ referrals to withdraw.' });
    }
    if (!amt || amt < 1000)
      return res.status(400).json({ error: 'Minimum withdrawal is KES 1,000' });
    if (amt > 100000)
      return res.status(400).json({ error: 'Maximum single withdrawal is KES 100,000' });
    if (Number(user.wallet_balance) <= 0)
      return res.status(400).json({ error: 'Your wallet balance is KES 0. Complete tasks to earn first.' });
    if (Number(user.wallet_balance) < amt)
      return res.status(400).json({ error: `Insufficient balance. You have KES ${Number(user.wallet_balance).toLocaleString()} available.` });
    if (!phone || !/^(07|01)\d{8}$/.test(phone.trim()))
      return res.status(400).json({ error: 'Enter a valid Kenyan M-Pesa number (07XXXXXXXX)' });

    // Block if already has a pending withdrawal
    const { data: pendingWD } = await supabase.from('withdrawals')
      .select('id').eq('user_id', user.id).eq('status', 'pending').maybeSingle();
    if (pendingWD)
      return res.status(429).json({ error: 'You already have a pending withdrawal request. Wait for it to be processed.' });

    // Atomically deduct balance — prevents double submission
    const { error: deductErr } = await supabase.from('users')
      .update({ wallet_balance: Number(user.wallet_balance) - amt })
      .eq('id', user.id)
      .eq('wallet_balance', user.wallet_balance); // optimistic lock
    if (deductErr)
      return res.status(409).json({ error: 'Balance changed. Please refresh and try again.' });

    await supabase.from('withdrawals').insert({
      user_id: user.id, amount: amt,
      phone: phone.trim(), status: 'pending',
    });
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'withdrawal', amount: amt, status: 'pending',
      description: 'Withdrawal request — awaiting admin approval',
    });

    res.json({ message: 'Withdrawal request submitted. Admin will process via M-Pesa within 24 hours.' });
  } catch (err) {
    console.error('[Withdraw Request] Error:', err);
    res.status(500).json({ error: 'Failed to submit withdrawal request' });
  }
});

// ── POST /api/payments/callback — Paystack Webhook ────────────
// NOTE: Withdrawals are NOT processed here — admin handles them manually.
// Signature is verified upstream in server.js before this handler runs.
router.post('/callback', async (req, res) => {
  try {
    console.log('[Paystack Callback] Received:', JSON.stringify(req.body));

    const event = req.body.event;
    const data = req.body.data || {};

    // Only act on successful charge events; ack everything else quietly.
    if (event !== 'charge.success') {
      return res.status(200).json({ message: 'OK' });
    }

    const ref = data.reference;
    const payStatus = (data.status || '').toUpperCase();
    const mpesaCode = data.id || data.reference || null;
    const paidAmount = Number(data.amount || 0) / 100; // Paystack sends amount in cents

    if (!ref) {
      console.warn('[Callback] Missing reference');
      return res.status(200).json({ message: 'OK' });
    }

    const { data: txn } = await supabase.from('transactions')
      .select('*').eq('paystack_reference', ref).maybeSingle();

    if (!txn) {
      console.warn('[Callback] No transaction found for ref:', ref);
      return res.status(200).json({ message: 'OK' });
    }

    // Idempotency — skip if already processed
    if (txn.status !== 'pending') {
      console.log('[Callback] Already processed:', ref);
      return res.status(200).json({ message: 'OK' });
    }

    const isSuccess = ['SUCCESS', 'COMPLETE', 'COMPLETED'].includes(payStatus);

    await supabase.from('transactions').update({
      status: isSuccess ? 'completed' : 'failed',
      mpesa_code: mpesaCode,
    }).eq('paystack_reference', ref);

    if (!isSuccess) {
      console.log('[Callback] Payment failed. Ref:', ref, 'Status:', payStatus);
      return res.status(200).json({ message: 'OK' });
    }

    const { data: user } = await supabase.from('users')
      .select('*').eq('id', txn.user_id).maybeSingle();
    if (!user) return res.status(200).json({ message: 'OK' });

    // ── Activation ──
    if (txn.type === 'activation') {
      if (user.status !== 'active') {
        await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
        console.log('[Callback] User activated:', user.email);
        if (user.referred_by) await grantReferralBonus(user, 'activation');
      }
    }

    // ── Package upgrade ──
    if (txn.type === 'package') {
      const pkgMatch = txn.description?.match(/^(\w+)\s+package/i);
      const pkg_name = pkgMatch?.[1]?.toLowerCase();
      if (pkg_name && PACKAGES[pkg_name]) {
        await supabase.from('users').update({ package_level: pkg_name }).eq('id', user.id);
        console.log('[Callback] Package upgraded:', user.email, '->', pkg_name);
        if (user.referred_by) await grantReferralBonus(user, 'package', pkg_name);
      }
    }

    // ── Deposit ──
    if (txn.type === 'deposit') {
      const credit = paidAmount || Number(txn.amount);
      await supabase.from('users')
        .update({ wallet_balance: Number(user.wallet_balance) + credit })
        .eq('id', user.id);
      console.log('[Callback] Deposit credited:', user.email, 'KES', credit);
    }

    res.status(200).json({ message: 'Callback processed' });
  } catch (err) {
    console.error('[Callback] Error:', err);
    res.status(200).json({ message: 'OK' }); // Always 200 to stop retries
  }
});

// ── Referral bonus helper ─────────────────────────────────────
async function grantReferralBonus(user, event, pkg_name = null) {
  try {
    const { data: referrer } = await supabase.from('users')
      .select('*').eq('referral_code', user.referred_by).maybeSingle();
    if (!referrer) return;

    const bonusMap = {
      registration: Number(process.env.REFERRAL_REGISTRATION_BONUS || 50),
      activation:   Number(process.env.REFERRAL_ACTIVATION_BONUS || 100),
      package:      Number(process.env.REFERRAL_PACKAGE_BONUS || 150),
    };
    const bonus = bonusMap[event];
    if (!bonus) return;

    // Check not already granted
    const { data: existing } = await supabase.from('referral_earnings')
      .select('id').eq('referrer_id', referrer.id).eq('referred_id', user.id)
      .eq('event', event).maybeSingle();
    if (existing) return; // idempotent

    await supabase.from('users')
      .update({ wallet_balance: Number(referrer.wallet_balance) + bonus })
      .eq('id', referrer.id);
    await supabase.from('referral_earnings').insert({
      referrer_id: referrer.id, referred_id: user.id, event, amount: bonus,
    });
    await supabase.from('transactions').insert({
      user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed',
      description: `Referral bonus — ${user.full_name} ${event}${pkg_name ? ' (' + pkg_name + ')' : ''}`,
    });
    console.log('[Referral] Bonus granted:', referrer.email, event, bonus);
  } catch (err) {
    console.error('[Referral] Bonus error:', err.message);
  }
}

// ── GET /api/payments/test — Admin config check ───────────────
router.get('/test', authenticate, requireAdmin, (req, res) => {
  res.json({
    paystack_configured: !!process.env.PAYSTACK_SECRET_KEY,
    secret_key_prefix: process.env.PAYSTACK_SECRET_KEY?.slice(0, 7) + '...',
  });
});

module.exports = router;
