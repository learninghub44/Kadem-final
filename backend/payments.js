require('dotenv').config();
const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { initiateSTKPush, checkTransactionStatus } = require('./paystack');
const { authenticate, requireActive, requireAdmin, invalidateUserCache } = require('./auth');

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

    // Attempt cap: 3 failed activation attempts → wait 5 minutes
    const FIVE_MIN = 5 * 60 * 1000;
    const { count: failedCount } = await supabase.from('transactions')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('type', 'activation')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - FIVE_MIN).toISOString());

    if ((failedCount || 0) >= 3) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please wait 5 minutes before trying again.',
        retry_after: 300,
      });
    }

    // Prevent duplicate pending activation
    const { data: existingPending } = await supabase.from('transactions')
      .select('id, created_at').eq('user_id', user.id)
      .eq('type', 'activation').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (existingPending) {
      const age = Date.now() - new Date(existingPending.created_at).getTime();
      if (age < 90 * 1000)
        return res.status(429).json({ error: 'STK push already sent. Check your phone and enter your M-Pesa PIN.' });
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', existingPending.id);
    }

    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(phoneToUse.trim(), ACTIVATION_FEE, reference, `${user.full_name} Activation`, user.email);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'activation', amount: ACTIVATION_FEE,
      status: 'pending', paystack_reference: reference,
      description: 'Account activation fee',
    });
    res.json({ message: 'STK push sent. Check your phone and enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('[Activate] Error:', err.message);
    const msg = err.message || '';
    if (msg.includes('Invalid') && msg.includes('key')) {
      return res.status(502).json({ error: 'Payment system configuration error. Please contact support.' });
    }
    res.status(502).json({ error: `Payment initiation failed: ${msg}` });
  }
});

// ── POST /api/payments/buy-package ────────────────────────────
router.post('/buy-package', authenticate, requireActive, async (req, res) => {
  try {
    const { package_name } = req.body;
    const pkg = PACKAGES[package_name];
    if (!pkg) return res.status(400).json({ error: 'Invalid package name' });

    const user = req.user;

    // Prevent duplicate pending package purchase
    const { data: existingPending } = await supabase.from('transactions')
      .select('id, created_at').eq('user_id', user.id)
      .eq('type', 'package').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (existingPending) {
      const age = Date.now() - new Date(existingPending.created_at).getTime();
      if (age < 90 * 1000)
        return res.status(429).json({ error: 'STK push already sent. Check your phone and enter your M-Pesa PIN.' });
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', existingPending.id);
    }

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
    res.status(502).json({ error: `Payment initiation failed: ${msg}` });
  }
});

// ── POST /api/payments/deposit ────────────────────────────────
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const amt = Number(req.body.amount);
    if (!amt || amt < 10 || amt > 150000)
      return res.status(400).json({ error: 'Amount must be between KES 10 and KES 150,000' });

    const user = req.user;

    // Prevent duplicate pending deposit
    const { data: existingPending } = await supabase.from('transactions')
      .select('id, created_at').eq('user_id', user.id)
      .eq('type', 'deposit').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (existingPending) {
      const age = Date.now() - new Date(existingPending.created_at).getTime();
      if (age < 90 * 1000)
        return res.status(429).json({ error: 'STK push already sent. Check your phone and enter your M-Pesa PIN.' });
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', existingPending.id);
    }

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
    res.status(502).json({ error: `Payment initiation failed: ${msg}` });
  }
});

// ── POST /api/payments/withdraw-request ──────────────────────
router.post('/withdraw-request', authenticate, requireActive, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const user = req.user;
    const amt = Number(amount);

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

    const { data: pendingWD } = await supabase.from('withdrawals')
      .select('id').eq('user_id', user.id).eq('status', 'pending').maybeSingle();
    if (pendingWD)
      return res.status(429).json({ error: 'You already have a pending withdrawal request. Wait for it to be processed.' });

    // Atomically deduct balance
    const { error: deductErr } = await supabase.from('users')
      .update({ wallet_balance: Number(user.wallet_balance) - amt })
      .eq('id', user.id)
      .eq('wallet_balance', user.wallet_balance);
    if (deductErr)
      return res.status(409).json({ error: 'Balance changed. Please refresh and try again.' });

    invalidateUserCache(user.id);

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
router.post('/callback', async (req, res) => {
  try {
    console.log('[Paystack Callback] Received:', JSON.stringify(req.body));

    const event = req.body.event;
    const data = req.body.data || {};

    if (event !== 'charge.success') {
      return res.status(200).json({ message: 'OK' });
    }

    const ref = data.reference;
    const payStatus = (data.status || '').toUpperCase();
    const mpesaCode = data.id || data.reference || null;
    const paidAmount = Number(data.amount || 0) / 100;

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

    // Already processed
    if (txn.status !== 'pending') {
      console.log('[Callback] Already processed:', ref);
      return res.status(200).json({ message: 'OK' });
    }

    const isSuccess = ['SUCCESS', 'COMPLETE', 'COMPLETED'].includes(payStatus);

    // Atomic update — only update if still pending
    const { data: updated } = await supabase.from('transactions').update({
      status: isSuccess ? 'completed' : 'failed',
      mpesa_code: mpesaCode,
    }).eq('paystack_reference', ref).eq('status', 'pending')
      .select('id');

    // If no row was updated, another request already processed this
    if (!updated || updated.length === 0) {
      console.log('[Callback] Race condition — already processed:', ref);
      return res.status(200).json({ message: 'OK' });
    }

    if (!isSuccess) {
      console.log('[Callback] Payment failed. Ref:', ref, 'Status:', payStatus);
      return res.status(200).json({ message: 'OK' });
    }

    await applyPaymentEffects(txn, mpesaCode, paidAmount);

    res.status(200).json({ message: 'Callback processed' });
  } catch (err) {
    console.error('[Callback] Error:', err);
    res.status(200).json({ message: 'OK' });
  }
});

// ── GET /api/payments/status/:reference — DB-only status ──────
router.get('/status/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;
    const { data: txn } = await supabase.from('transactions')
      .select('status, type, amount, created_at')
      .eq('paystack_reference', reference)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    return res.json({
      status: txn.status,
      type: txn.type,
      amount: txn.amount,
      created_at: txn.created_at,
    });
  } catch (err) {
    console.error('[Status] Error:', err.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// ── POST /api/payments/verify/:reference — Manual verification ─
router.post('/verify/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;
    const { data: txn } = await supabase.from('transactions')
      .select('*')
      .eq('paystack_reference', reference)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    // Already final — return stored result
    if (txn.status !== 'pending') {
      return res.json({
        status: txn.status,
        message: txn.status === 'completed' ? 'Payment already completed.' : 'Payment failed.',
      });
    }

    // Check with Paystack
    let live = null;
    try {
      live = await checkTransactionStatus(reference);
    } catch (e) {
      console.error('[Verify] Paystack verify failed:', e.message);
      return res.json({ status: 'pending', message: 'Unable to verify with Paystack. Please wait and try again.' });
    }

    const payStatus = (live?.data?.status || '').toLowerCase();
    const mpesaCode = live?.data?.id || null;
    const paidAmount = Number(live?.data?.amount || 0) / 100;

    let finalStatus = 'pending';

    if (payStatus === 'success') {
      finalStatus = 'completed';
    } else if (['abandoned', 'failed', 'cancelled', 'cancelled_by_user', 'timeout', 'unpaid', 'unknown_transaction', 'not_found'].includes(payStatus)) {
      finalStatus = 'failed';
    } else {
      const ageMs = Date.now() - new Date(txn.created_at).getTime();
      if (ageMs >= 90 * 1000) {
        finalStatus = 'failed';
      }
    }

    if (finalStatus === 'pending') {
      return res.json({ status: 'pending', message: 'Payment still processing. Please wait...' });
    }

    // Atomic update — only update if still pending
    const { data: updated } = await supabase.from('transactions')
      .update({ status: finalStatus, mpesa_code: mpesaCode })
      .eq('paystack_reference', reference)
      .eq('status', 'pending')
      .select('id');

    if (!updated || updated.length === 0) {
      const { data: current } = await supabase.from('transactions')
        .select('status').eq('paystack_reference', reference).maybeSingle();
      return res.json({ status: current?.status || finalStatus, message: 'Payment already processed.' });
    }

    // Apply effects for successful payment
    if (finalStatus === 'completed') {
      await applyPaymentEffects(txn, mpesaCode, paidAmount);
    }

    return res.json({
      status: finalStatus,
      message: finalStatus === 'completed'
        ? 'Payment completed successfully.'
        : 'Payment failed or was cancelled.',
    });
  } catch (err) {
    console.error('[Verify] Error:', err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── Apply the effect of a successful payment ──────────────────
async function applyPaymentEffects(txn, mpesaCode, paidAmount) {
  const { data: user } = await supabase.from('users')
    .select('*').eq('id', txn.user_id).maybeSingle();
  if (!user) return false;

  if (txn.type === 'activation') {
    if (user.status !== 'active') {
      await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
      invalidateUserCache(user.id);
      console.log('[Payment] User activated:', user.email);
      if (user.referred_by) await grantReferralBonus(user, 'activation');
    }
  } else if (txn.type === 'package') {
    const pkgMatch = txn.description?.match(/^(\w+)\s+package/i);
    const pkg_name = pkgMatch?.[1]?.toLowerCase();
    if (pkg_name && PACKAGES[pkg_name]) {
      await supabase.from('users').update({ package_level: pkg_name }).eq('id', user.id);
      invalidateUserCache(user.id);
      console.log('[Payment] Package upgraded:', user.email, '->', pkg_name);
      if (user.referred_by) await grantReferralBonus(user, 'package', pkg_name);
    }
  } else if (txn.type === 'deposit') {
    // Atomic increment — no read-modify-write race
    const credit = paidAmount || Number(txn.amount);
    await supabase.rpc('increment_wallet', { user_id: txn.user_id, amount: credit });
    invalidateUserCache(txn.user_id);
    console.log('[Payment] Deposit credited:', user.email, 'KES', credit);
  }
  return true;
}

// ── Referral bonus helper ─────────────────────────────────────
async function grantReferralBonus(user, event, pkg_name = null) {
  try {
    const { data: referrer } = await supabase.from('users')
      .select('id, referral_code').eq('referral_code', user.referred_by).maybeSingle();
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
    if (existing) return;

    // Atomic increment for referrer wallet
    await supabase.rpc('increment_wallet', { user_id: referrer.id, amount: bonus });
    invalidateUserCache(referrer.id);

    await supabase.from('referral_earnings').insert({
      referrer_id: referrer.id, referred_id: user.id, event, amount: bonus,
    });
    await supabase.from('transactions').insert({
      user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed',
      description: `Referral bonus — ${user.full_name} ${event}${pkg_name ? ' (' + pkg_name + ')' : ''}`,
    });
    console.log('[Referral] Bonus granted:', referrer.id, event, bonus);
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
