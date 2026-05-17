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
const ACTIVATION_FEE = 550;

// POST /api/payments/activate
router.post('/activate', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.status === 'active') return res.status(400).json({ error: 'Account already active' });
    const reference = `ACT-${user.id.slice(0, 8)}-${Date.now()}`;
    const result = await initiateSTKPush(user.phone, ACTIVATION_FEE, reference, 'Kadem Account Activation');
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'activation', amount: ACTIVATION_FEE, status: 'pending',
      payhero_reference: reference, description: 'Account activation fee',
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('Activation error:', err.response?.data || err.message);
    res.status(502).json({ error: 'Payment failed. Check your PayHero configuration.', details: err.response?.data });
  }
});

// POST /api/payments/buy-package
router.post('/buy-package', authenticate, requireActive, async (req, res) => {
  try {
    const { package_name } = req.body;
    const pkg = PACKAGES[package_name];
    if (!pkg) return res.status(400).json({ error: 'Invalid package name' });
    const user = req.user;
    const reference = `PKG-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, pkg.price, reference, `Kadem ${package_name} Package`);
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'package', amount: pkg.price, status: 'pending',
      payhero_reference: reference, description: `${package_name} package purchase`,
    });
    res.json({ message: 'STK push sent. Enter your M-Pesa PIN.', reference });
  } catch (err) {
    console.error('Buy package error:', err.response?.data || err.message);
    res.status(502).json({ error: 'Payment failed.', details: err.response?.data });
  }
});

// POST /api/payments/deposit
router.post('/deposit', authenticate, requireActive, async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt < 10) return res.status(400).json({ error: 'Minimum deposit is KES 10' });
    const user = req.user;
    const reference = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;
    await initiateSTKPush(user.phone, amt, reference, 'Kadem Wallet Deposit');
    await supabase.from('transactions').insert({
      user_id: user.id, type: 'deposit', amount: amt, status: 'pending',
      payhero_reference: reference, description: 'Wallet deposit',
    });
    res.json({ message: 'STK push sent.', reference });
  } catch (err) {
    console.error('Deposit error:', err.response?.data || err.message);
    res.status(502).json({ error: 'Payment failed.', details: err.response?.data });
  }
});

// POST /api/payments/withdraw-request
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

    // Deduct balance atomically
    const { error: deductErr } = await supabase
      .from('users')
      .update({ wallet_balance: Number(user.wallet_balance) - amt })
      .eq('id', user.id)
      .eq('wallet_balance', user.wallet_balance); // optimistic lock

    if (deductErr) return res.status(400).json({ error: 'Could not process withdrawal. Please try again.' });

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

// POST /api/payments/callback — PayHero webhook
router.post('/callback', async (req, res) => {
  try {
    console.log('PayHero callback:', JSON.stringify(req.body));
    const { external_reference, status, Status, mpesa_receipt_number, MpesaReceiptNumber, amount, Amount } = req.body;

    // PayHero sends status in different cases/fields
    const payStatus = (status || Status || '').toUpperCase();
    const mpesaCode = mpesa_receipt_number || MpesaReceiptNumber || null;
    const paidAmount = Number(amount || Amount || 0);
    const ref = external_reference;

    if (!ref) return res.status(400).json({ error: 'Invalid callback payload' });

    const { data: txn } = await supabase
      .from('transactions')
      .select('*')
      .eq('payhero_reference', ref)
      .maybeSingle();

    if (!txn) {
      console.warn('Callback: transaction not found for reference', ref);
      return res.status(200).json({ message: 'OK' }); // Return 200 to stop retries
    }

    const isSuccess = ['SUCCESS', 'COMPLETE', 'COMPLETED'].includes(payStatus);

    // Update transaction status
    await supabase.from('transactions').update({
      status: isSuccess ? 'completed' : 'failed',
      mpesa_code: mpesaCode,
    }).eq('payhero_reference', ref);

    if (!isSuccess) {
      console.log('Payment failed for reference:', ref, 'Status:', payStatus);
      return res.json({ message: 'Payment failure recorded' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', txn.user_id).maybeSingle();
    if (!user) return res.status(200).json({ message: 'OK' });

    if (txn.type === 'activation') {
      await supabase.from('users').update({ status: 'active' }).eq('id', user.id);
      console.log('User activated:', user.email);

      // Referral activation bonus
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

    if (txn.type === 'package') {
      const pkgMatch = txn.description?.match(/^(\w+)\s+package/i);
      const pkg_name = pkgMatch?.[1]?.toLowerCase();
      if (pkg_name && PACKAGES[pkg_name]) {
        await supabase.from('users').update({ package_level: pkg_name }).eq('id', user.id);
        console.log('Package upgraded:', user.email, '->', pkg_name);

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

    if (txn.type === 'deposit') {
      const credit = paidAmount || Number(txn.amount);
      await supabase.from('users').update({ wallet_balance: Number(user.wallet_balance) + credit }).eq('id', user.id);
      console.log('Deposit credited:', user.email, credit);
    }

    res.json({ message: 'Callback processed successfully' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(200).json({ message: 'OK' }); // Always 200 to prevent PayHero retries
  }
});

module.exports = router;
