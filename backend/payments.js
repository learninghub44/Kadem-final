require('dotenv').config();
const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { initiateSTKPush, initiateWithdrawal } = require('./payhero');
const { authenticate, requireActive, requireAdmin } = require('./auth');

const PACKAGES = {
  starter: { price: 100 },
  bronze:  { price: 500 },
  silver:  { price: 1500 },
  gold:    { price: 2999 },
};
const ACTIVATION_FEE = 550;

// ── POST /api/payments/activate ───────────────────────────────
router.post('/activate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.status === 'active') return res.status(400).json({ error: 'Account already active' });
    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, ACTIVATION_FEE, reference, `${user.full_name} Activation`);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'activation', amount: ACTIVATION_FEE,
      status: 'pending', payhero_reference: reference, description: 'Account activation fee',
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('Activate error:', err.message);
    res.status(502).json({ error: 'Payment initiation failed: ' + err.message });
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
    await initiateSTKPush(user.phone, pkg.price, reference, `${package_name} Package`);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'package', amount: pkg.price,
      status: 'pending', payhero_reference: reference,
      description: `${package_name} package`,
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('Buy package error:', err.message);
    res.status(502).json({ error: 'Payment initiation failed: ' + err.message });
  }
});

// ── POST /api/payments/deposit ────────────────────────────────
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const amt = Number(req.body.amount);
    if (!amt || amt < 10) return res.status(400).json({ error: 'Minimum deposit is KES 10' });
    const user = req.user;
    const reference = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, amt, reference, 'Wallet Deposit');
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'deposit', amount: amt,
      status: 'pending', payhero_reference: reference, description: 'Wallet deposit',
    });
    res.json({ message: 'STK push sent.', reference });
  } catch (err) {
    console.error('Deposit error:', err.message);
    res.status(502).json({ error: 'Payment initiation failed: ' + err.message });
  }
});

// ── POST /api/payments/withdraw-request ──────────────────────
router.post('/withdraw-request', authenticate, requireActive, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const user = req.user;
    const amt = Number(amount);
    if (!['silver', 'gold'].includes(user.package_level))
      return res.status(403).json({ error: 'Withdrawals require Silver or Gold package' });
    if (amt < 1000) return res.status(400).json({ error: 'Minimum withdrawal is KES 1,000' });
    if (Number(user.wallet_balance) < amt)
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    if (!phone || !/^(07|01)\d{8}$/.test(phone.trim()))
      return res.status(400).json({ error: 'Enter a valid M-Pesa phone number' });

    // Deduct balance first
    const { error: deductErr } = await supabase.from('users')
      .update({ wallet_balance: Number(user.wallet_balance) - amt })
      .eq('id', user.id).eq('wallet_balance', user.wallet_balance);
    if (deductErr) return res.status(400).json({ error: 'Could not process. Please try again.' });

    await supabase.from('withdrawals').insert({
      user_id: user.id, amount: amt, phone: phone.trim(), status: 'pending',
    });
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'withdrawal', amount: amt, status: 'pending',
      description: 'Withdrawal request — awaiting admin approval',
    });
    res.json({ message: 'Withdrawal request submitted. Admin will process within 24 hours.' });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to submit withdrawal' });
  }
});

// ── POST /api/payments/callback — PayHero Webhook ────────────
router.post('/callback', async (req, res) => {
  try {
    console.log('[PayHero Callback]:', JSON.stringify(req.body));

    // PayHero sends: external_reference, status (SUCCESS/FAILED/CANCELLED),
    // CheckoutRequestID, amount, phone_number, MpesaReceiptNumber
    const {
      external_reference,
      status,
      Status,
      MpesaReceiptNumber,
      mpesa_receipt_number,
      amount,
      Amount,
    } = req.body;

    const ref = external_reference;
    const payStatus = (status || Status || '').toUpperCase();
    const mpesaCode = MpesaReceiptNumber || mpesa_receipt_number || null;
    const paidAmount = Number(amount || Amount || 0);

    if (!ref) {
      console.warn('[PayHero Callback] Missing external_reference');
      return res.status(200).json({ message: 'OK' });
    }

    // Find the transaction
    const { data: txn } = await supabase.from('transactions')
      .select('*').eq('payhero_reference', ref).maybeSingle();

    if (!txn) {
      console.warn('[PayHero Callback] No transaction for ref:', ref);
      return res.status(200).json({ message: 'OK' });
    }

    const isSuccess = ['SUCCESS', 'COMPLETE', 'COMPLETED'].includes(payStatus);

    // Update transaction
    await supabase.from('transactions').update({
      status: isSuccess ? 'completed' : 'failed',
      mpesa_code: mpesaCode,
    }).eq('payhero_reference', ref);

    if (!isSuccess) {
      console.log('[PayHero] Payment failed. Ref:', ref, 'Status:', payStatus);
      return res.status(200).json({ message: 'OK' });
    }

    // Fetch fresh user
    const { data: user } = await supabase.from('users').select('*').eq('id', txn.user_id).maybeSingle();
    if (!user) return res.status(200).json({ message: 'OK' });

    // Handle activation
    if (txn.type === 'activation') {
      await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
      console.log('[PayHero] User activated:', user.email);

      if (user.referred_by) {
        const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).maybeSingle();
        if (referrer) {
          const bonus = Number(process.env.REFERRAL_ACTIVATION_BONUS || 100);
          await supabase.from('users').update({ wallet_balance: Number(referrer.wallet_balance) + bonus }).eq('id', referrer.id);
          await supabase.from('referral_earnings').insert({ referrer_id: referrer.id, referred_id: user.id, event: 'activation', amount: bonus });
          await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus — ${user.full_name} activated` });
        }
      }
    }

    // Handle package upgrade
    if (txn.type === 'package') {
      const pkgMatch = txn.description?.match(/^(\w+)\s+package/i);
      const pkg_name = pkgMatch?.[1]?.toLowerCase();
      if (pkg_name && PACKAGES[pkg_name]) {
        await supabase.from('users').update({ package_level: pkg_name }).eq('id', user.id);
        console.log('[PayHero] Package upgraded:', user.email, '->', pkg_name);

        if (user.referred_by) {
          const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).maybeSingle();
          if (referrer) {
            const bonus = Number(process.env.REFERRAL_PACKAGE_BONUS || 150);
            await supabase.from('users').update({ wallet_balance: Number(referrer.wallet_balance) + bonus }).eq('id', referrer.id);
            await supabase.from('referral_earnings').insert({ referrer_id: referrer.id, referred_id: user.id, event: 'package', amount: bonus });
            await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus — ${user.full_name} bought ${pkg_name}` });
          }
        }
      }
    }

    // Handle deposit
    if (txn.type === 'deposit') {
      const credit = paidAmount || Number(txn.amount);
      await supabase.from('users').update({ wallet_balance: Number(user.wallet_balance) + credit }).eq('id', user.id);
      console.log('[PayHero] Deposit credited:', user.email, credit);
    }

    res.status(200).json({ message: 'Callback processed' });
  } catch (err) {
    console.error('[PayHero Callback] Error:', err);
    res.status(200).json({ message: 'OK' }); // Always 200 to stop retries
  }
});

// ── GET /api/payments/test ── Admin only ──────────────────────
router.get('/test', authenticate, requireAdmin, (req, res) => {
  res.json({
    payhero_channel_id: process.env.PAYHERO_CHANNEL_ID,
    payhero_callback_url: process.env.PAYHERO_CALLBACK_URL,
    auth_configured: !!process.env.PAYHERO_BASIC_AUTH,
  });
});

module.exports = router;
