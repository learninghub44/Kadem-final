const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { initiateSTKPush, initiateWithdrawal } = require('./payhero');
const { authenticate, requireActive, requireAdmin } = require('./auth');

const ACTIVATION_FEE = 550;
const PACKAGES = {
  starter: { price: 100 },
  bronze:  { price: 500 },
  silver:  { price: 1500 },
  gold:    { price: 2999 },
};

// Convert raw PayHero errors into user-friendly messages
const friendlyError = (errMsg) => {
  const msg = (errMsg || '').toLowerCase();
  if (msg.includes('insufficient balance'))
    return 'Payments are temporarily unavailable. Please contact support on WhatsApp: 0742791838';
  if (msg.includes('invalid channel') || msg.includes('channel'))
    return 'Payment channel error. Please contact support.';
  if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('403'))
    return 'Payment gateway error. Please contact support.';
  if (msg.includes('bad_request'))
    return 'Payment request failed. Please contact support.';
  if (msg.includes('timeout') || msg.includes('econnrefused'))
    return 'Payment service is unreachable. Please try again in a moment.';
  return 'Payment failed. Please try again or contact support on WhatsApp: 0742791838';
};

// POST /api/payments/activate
router.post('/activate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.status === 'active') return res.status(400).json({ error: 'Account is already active' });

    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;

    let stkResult;
    try {
      stkResult = await initiateSTKPush(user.phone, ACTIVATION_FEE, reference, user.full_name);
    } catch (payErr) {
      return res.status(502).json({ error: friendlyError(payErr.message) });
    }

    await supabase.from('transactions').insert({
      user_id: user.id, type: 'activation', amount: ACTIVATION_FEE,
      status: 'pending', payhero_reference: reference, description: 'Account activation fee',
    });

    res.json({ message: 'STK push sent! Check your phone and enter your M-Pesa PIN.', reference, payhero: stkResult });
  } catch (err) {
    console.error('[Activate] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/payments/buy-package
router.post('/buy-package', authenticate, requireActive, async (req, res) => {
  try {
    const { package_name } = req.body;
    const pkg = PACKAGES[package_name];
    if (!pkg) return res.status(400).json({ error: 'Invalid package name' });

    const user = req.user;
    const reference = `PKG-${package_name.toUpperCase()}-${user.id.slice(0, 8)}-${Date.now()}`;

    let stkResult;
    try {
      stkResult = await initiateSTKPush(user.phone, pkg.price, reference, user.full_name);
    } catch (payErr) {
      return res.status(502).json({ error: friendlyError(payErr.message) });
    }

    await supabase.from('transactions').insert({
      user_id: user.id, type: 'package', amount: pkg.price,
      status: 'pending', payhero_reference: reference, description: `${package_name} package`,
    });

    res.json({ message: 'STK push sent! Enter your M-Pesa PIN.', reference, payhero: stkResult });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/payments/deposit
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) < 10) return res.status(400).json({ error: 'Minimum deposit is KES 10' });

    const user = req.user;
    const reference = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;

    let stkResult;
    try {
      stkResult = await initiateSTKPush(user.phone, amount, reference, user.full_name);
    } catch (payErr) {
      return res.status(502).json({ error: friendlyError(payErr.message) });
    }

    await supabase.from('transactions').insert({
      user_id: user.id, type: 'deposit', amount: Number(amount),
      status: 'pending', payhero_reference: reference, description: 'Wallet deposit',
    });

    res.json({ message: 'STK push sent! Enter your M-Pesa PIN.', reference, payhero: stkResult });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/payments/withdraw-request
router.post('/withdraw-request', authenticate, requireActive, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const user = req.user;

    if (!['silver', 'gold'].includes(user.package_level))
      return res.status(403).json({ error: 'Withdrawals require Silver or Gold package' });
    if (!amount || Number(amount) < 1000)
      return res.status(400).json({ error: 'Minimum withdrawal is KES 1,000' });
    if (Number(user.wallet_balance) < Number(amount))
      return res.status(400).json({ error: 'Insufficient wallet balance' });

    const newBalance = Number(user.wallet_balance) - Number(amount);
    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);
    await supabase.from('withdrawals').insert({ user_id: user.id, amount: Number(amount), phone: phone || user.phone, status: 'pending' });
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'withdrawal', amount: Number(amount),
      status: 'pending', description: 'Withdrawal request — pending admin approval',
    });

    res.json({ message: 'Withdrawal submitted. Admin will review and send M-Pesa within 24 hours.' });
  } catch (err) {
    console.error('[Withdraw] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/payments/callback — PayHero webhook
router.post('/callback', async (req, res) => {
  try {
    console.log('[Callback] PayHero payload:', JSON.stringify(req.body));

    const { external_reference, status, Status, mpesa_receipt_number, MpesaReceiptNumber, amount, Amount } = req.body;
    const ref = external_reference;
    const payStatus = status || Status;
    const mpesaCode = mpesa_receipt_number || MpesaReceiptNumber || null;
    const paidAmount = amount || Amount;

    if (!ref) return res.status(400).json({ error: 'Missing external_reference' });

    const { data: txn } = await supabase.from('transactions').select('*').eq('payhero_reference', ref).single();
    if (!txn) return res.status(200).json({ message: 'Transaction not found, ignoring' });

    const isSuccess = payStatus === 'SUCCESS';
    await supabase.from('transactions').update({ status: isSuccess ? 'completed' : 'failed', mpesa_code: mpesaCode }).eq('payhero_reference', ref);
    if (!isSuccess) return res.status(200).json({ message: 'Failed payment recorded' });

    const { data: user } = await supabase.from('users').select('*').eq('id', txn.user_id).single();
    if (!user) return res.status(200).json({ message: 'User not found' });

    if (txn.type === 'activation') {
      await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
      if (user.referred_by) {
        const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).single();
        if (referrer) {
          const bonus = Number(process.env.REFERRAL_ACTIVATION_BONUS || 100);
          await supabase.from('users').update({ wallet_balance: Number(referrer.wallet_balance) + bonus }).eq('id', referrer.id);
          await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus: ${user.full_name} activated` });
        }
      }
    }

    if (txn.type === 'package') {
      const parts = ref.split('-');
      const pkgName = parts[1]?.toLowerCase();
      if (pkgName && PACKAGES[pkgName]) {
        await supabase.from('users').update({ package_level: pkgName }).eq('id', user.id);
        if (user.referred_by) {
          const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).single();
          if (referrer) {
            const bonus = Number(process.env.REFERRAL_PACKAGE_BONUS || 150);
            await supabase.from('users').update({ wallet_balance: Number(referrer.wallet_balance) + bonus }).eq('id', referrer.id);
            await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus: ${user.full_name} bought ${pkgName}` });
          }
        }
      }
    }

    if (txn.type === 'deposit') {
      const credited = Number(paidAmount || txn.amount);
      await supabase.from('users').update({ wallet_balance: Number(user.wallet_balance) + credited }).eq('id', user.id);
    }

    return res.status(200).json({ message: 'Callback processed successfully' });
  } catch (err) {
    console.error('[Callback] Error:', err);
    return res.status(500).json({ error: 'Callback processing failed' });
  }
});

// GET /api/payments/test-payhero — Admin only
router.get('/test-payhero', authenticate, requireAdmin, (req, res) => {
  res.json({
    PAYHERO_AUTHORIZATION: process.env.PAYHERO_AUTHORIZATION ? '✅ SET' : '❌ MISSING',
    PAYHERO_CHANNEL_ID: process.env.PAYHERO_CHANNEL_ID || '❌ MISSING',
    PAYHERO_CALLBACK_URL: process.env.PAYHERO_CALLBACK_URL || '❌ MISSING',
  });
});

module.exports = router;
