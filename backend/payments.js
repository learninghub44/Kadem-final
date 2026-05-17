const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase');
const { initiateSTKPush, initiateWithdrawal } = require('./payhero');
const { authenticate, requireActive } = require('./auth');

const PACKAGES = {
  starter: { price: 100, multiplier: 1.0 },
  bronze:  { price: 500, multiplier: 1.5 },
  silver:  { price: 1500, multiplier: 2.0 },
  gold:    { price: 2999, multiplier: 3.0 },
};

// Activation fee
const ACTIVATION_FEE = 550;

// POST /api/payments/activate
router.post('/activate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.status === 'active') return res.status(400).json({ error: 'Account already active' });

    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;

    let result;
    try {
      result = await initiateSTKPush(user.phone, ACTIVATION_FEE, reference, 'Kadem Account Activation');
    } catch (payErr) {
      console.error('PayHero STK error:', payErr.response?.data || payErr.message);
      return res.status(502).json({
        error: 'Payment gateway error. Please check your PayHero credentials.',
        details: payErr.response?.data || payErr.message,
      });
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'activation',
      amount: ACTIVATION_FEE,
      status: 'pending',
      payhero_reference: reference,
      description: 'Account activation fee',
    });

    res.json({ message: 'STK push sent to your phone. Enter M-Pesa PIN to complete.', reference, data: result });
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// POST /api/payments/buy-package
router.post('/buy-package', authenticate, requireActive, async (req, res) => {
  try {
    const { package_name } = req.body;
    const pkg = PACKAGES[package_name];
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    const user = req.user;
    const reference = `PKG-${user.id.slice(0, 8)}-${Date.now()}`;

    let result;
    try {
      result = await initiateSTKPush(user.phone, pkg.price, reference, `Kadem ${package_name} Package`);
    } catch (payErr) {
      console.error('PayHero package error:', payErr.response?.data || payErr.message);
      return res.status(502).json({
        error: 'Payment gateway error.',
        details: payErr.response?.data || payErr.message,
      });
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'package',
      amount: pkg.price,
      status: 'pending',
      payhero_reference: reference,
      description: `${package_name} package purchase`,
    });

    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference, data: result });
  } catch (err) {
    console.error('Buy package error:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// POST /api/payments/deposit
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum deposit is KES 10' });

    const user = req.user;
    const reference = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;

    let result;
    try {
      result = await initiateSTKPush(user.phone, amount, reference, 'Kadem Wallet Deposit');
    } catch (payErr) {
      console.error('Deposit payment error:', payErr.response?.data || payErr.message);
      return res.status(502).json({ error: 'Payment gateway error.', details: payErr.response?.data });
    }

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'deposit',
      amount,
      status: 'pending',
      payhero_reference: reference,
      description: 'Wallet deposit',
    });

    res.json({ message: 'STK push sent.', reference, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate deposit' });
  }
});

// POST /api/payments/withdraw-request
router.post('/withdraw-request', authenticate, requireActive, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const user = req.user;

    if (!['silver', 'gold'].includes(user.package_level)) {
      return res.status(403).json({ error: 'Withdrawal requires Silver or Gold package' });
    }
    if (amount < 1000) return res.status(400).json({ error: 'Minimum withdrawal is KES 1000' });
    if (user.wallet_balance < amount) return res.status(400).json({ error: 'Insufficient wallet balance' });

    // Deduct balance and create pending withdrawal (admin must approve)
    await supabase.from('users').update({ wallet_balance: user.wallet_balance - amount }).eq('id', user.id);

    await supabase.from('withdrawals').insert({
      user_id: user.id,
      amount,
      phone: phone || user.phone,
      status: 'pending',
    });

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      description: 'Withdrawal request — awaiting admin approval',
    });

    res.json({ message: 'Withdrawal request submitted. Admin will review and process within 24 hours.' });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ error: 'Failed to submit withdrawal' });
  }
});

// POST /api/payments/callback — PayHero webhook
router.post('/callback', async (req, res) => {
  try {
    console.log('PayHero callback received:', JSON.stringify(req.body));
    const { external_reference, status, mpesa_receipt_number, amount } = req.body;

    if (!external_reference) return res.status(400).json({ error: 'Invalid callback' });

    const { data: txn } = await supabase
      .from('transactions')
      .select('*')
      .eq('payhero_reference', external_reference)
      .single();

    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const isSuccess = status === 'SUCCESS';

    await supabase.from('transactions').update({
      status: isSuccess ? 'completed' : 'failed',
      mpesa_code: mpesa_receipt_number || null,
    }).eq('payhero_reference', external_reference);

    if (!isSuccess) return res.json({ message: 'Payment failed, recorded.' });

    const { data: user } = await supabase.from('users').select('*').eq('id', txn.user_id).single();

    // Handle activation
    if (txn.type === 'activation') {
      await supabase.from('users').update({ status: 'active' }).eq('id', user.id);

      if (user.referred_by) {
        const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).single();
        if (referrer) {
          const bonus = Number(process.env.REFERRAL_ACTIVATION_BONUS || 100);
          await supabase.from('users').update({ wallet_balance: referrer.wallet_balance + bonus }).eq('id', referrer.id);
          await supabase.from('referral_earnings').insert({ referrer_id: referrer.id, referred_id: user.id, event: 'activation', amount: bonus });
          await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus — ${user.full_name} activated` });
        }
      }
    }

    // Handle package purchase
    if (txn.type === 'package') {
      const pkgMatch = txn.description.match(/^(\w+)\s+package/i);
      const pkg_name = pkgMatch ? pkgMatch[1].toLowerCase() : null;

      if (pkg_name && PACKAGES[pkg_name]) {
        await supabase.from('users').update({ package_level: pkg_name }).eq('id', user.id);

        if (user.referred_by) {
          const { data: referrer } = await supabase.from('users').select('*').eq('referral_code', user.referred_by).single();
          if (referrer) {
            const bonus = Number(process.env.REFERRAL_PACKAGE_BONUS || 150);
            await supabase.from('users').update({ wallet_balance: referrer.wallet_balance + bonus }).eq('id', referrer.id);
            await supabase.from('referral_earnings').insert({ referrer_id: referrer.id, referred_id: user.id, event: 'package', amount: bonus });
            await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: bonus, status: 'completed', description: `Referral bonus — ${user.full_name} bought ${pkg_name}` });
          }
        }
      }
    }

    // Handle deposit
    if (txn.type === 'deposit') {
      await supabase.from('users').update({ wallet_balance: user.wallet_balance + Number(amount) }).eq('id', user.id);
    }

    res.json({ message: 'Callback processed successfully' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

module.exports = router;
