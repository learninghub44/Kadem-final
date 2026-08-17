const axios = require('axios');
const crypto = require('crypto');

const PAYSTACK_BASE = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const client = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    'Authorization': `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Paystack wants amounts in the lowest currency subunit (cents for KES)
const toSubunit = (amount) => Math.round(Number(amount) * 100);

// Charge API wants "+254722000000"; Transfer recipient wants local "0722000000"
const toIntlPhone = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return `+${p}`;
};
const toLocalPhone = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('254')) p = '0' + p.slice(3);
  return p;
};

const extractError = (err) => {
  const data = err.response?.data;
  return data?.message || data?.error || err.message;
};

// ── Charge a customer via M-Pesa STK push ──────────────────────
const initiateSTKPush = async (phone, amount, reference, description = 'Kadem Payment', email = null) => {
  const payload = {
    email: email || `${toLocalPhone(phone)}@kadem.no-reply.com`,
    amount: toSubunit(amount),
    currency: 'KES',
    reference,
    mobile_money: {
      phone: toIntlPhone(phone),
      provider: 'mpesa',
    },
    metadata: { description },
  };

  console.log('[Paystack] Charge payload:', JSON.stringify(payload));

  try {
    const { data } = await client.post('/charge', payload);
    console.log('[Paystack] Charge response:', JSON.stringify(data));
    return data;
  } catch (err) {
    const msg = extractError(err);
    console.error('[Paystack] Charge FAILED:', msg);
    throw new Error(`Paystack: ${msg}`);
  }
};

// ── Verify a transaction by reference ──────────────────────────
const checkTransactionStatus = async (reference) => {
  try {
    const { data } = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    return data;
  } catch (err) {
    const msg = extractError(err);
    console.error('[Paystack] Verify FAILED:', msg);
    throw new Error(`Paystack: ${msg}`);
  }
};

// ── Payout to a user's M-Pesa number ───────────────────────────
const initiateWithdrawal = async (phone, amount, reference, name = 'Kadem User') => {
  try {
    const { data: recipientRes } = await client.post('/transferrecipient', {
      type: 'mobile_money',
      name,
      account_number: toLocalPhone(phone),
      bank_code: 'MPESA',
      currency: 'KES',
    });
    const recipientCode = recipientRes?.data?.recipient_code;
    if (!recipientCode) throw new Error('Failed to create transfer recipient');

    const { data: transferRes } = await client.post('/transfer', {
      source: 'balance',
      amount: toSubunit(amount),
      recipient: recipientCode,
      reference,
      reason: 'Kadem Withdrawal',
    });
    console.log('[Paystack] Transfer response:', JSON.stringify(transferRes));
    return transferRes;
  } catch (err) {
    const msg = extractError(err);
    console.error('[Paystack] Withdrawal FAILED:', msg);
    throw new Error(`Paystack: ${msg}`);
  }
};

// ── Verify webhook signature (x-paystack-signature header) ─────
// IMPORTANT: must be computed over the raw, unparsed request body.
const verifyWebhookSignature = (rawBody, signature) => {
  if (!SECRET_KEY || !signature) return false;
  const hash = crypto.createHmac('sha512', SECRET_KEY).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
};

module.exports = {
  initiateSTKPush,
  checkTransactionStatus,
  initiateWithdrawal,
  verifyWebhookSignature,
};
