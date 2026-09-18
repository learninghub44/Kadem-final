const axios = require('axios');

const PAYHERO_BASE = 'https://backend.payhero.co.ke/api/v2';
const CHANNEL_ID = parseInt(process.env.PAYHERO_CHANNEL_ID);

// PayHero does not support custom headers or HMAC signatures on its webhook —
// it simply POSTs to whatever callback_url you registered for that request.
// So the only reliable way to authenticate the callback is to embed a secret
// in the URL itself and check it on arrival (see server.js).
const WEBHOOK_SECRET = process.env.PAYHERO_WEBHOOK_SECRET;
const BASE_CALLBACK_URL = process.env.PAYHERO_CALLBACK_URL;
const CALLBACK_URL = WEBHOOK_SECRET
  ? `${BASE_CALLBACK_URL}${BASE_CALLBACK_URL.includes('?') ? '&' : '?'}secret=${encodeURIComponent(WEBHOOK_SECRET)}`
  : BASE_CALLBACK_URL;

// Strip any accidental "Basic " prefix then re-add it cleanly
const rawAuth = (process.env.PAYHERO_BASIC_AUTH || '').replace(/^Basic\s+/i, '').trim();
const AUTH_HEADER = `Basic ${rawAuth}`;

const client = axios.create({
  baseURL: PAYHERO_BASE,
  headers: {
    'Authorization': AUTH_HEADER,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Returns 2547XXXXXXXX / 2541XXXXXXXX (12 digits) or throws. Never forwards a
// malformed number to PayHero — previously a short/odd number (e.g. 9 digits
// like 070159192) was blindly prefixed with 254 and rejected upstream.
const normalizePhone = (phone) => {
  let p = String(phone || '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (p.startsWith('254')) p = p.slice(3);
  else if (p.startsWith('0')) p = p.slice(1);
  if (!/^[71]\d{8}$/.test(p)) {
    throw new Error('Invalid Kenyan phone number. Use the format 07XXXXXXXX (update it in your Profile).');
  }
  return '254' + p;
};

// ── Network detection for M-Pesa vs Airtel Money ────────────────
// PayHero's /withdraw endpoint requires the correct network_code per
// carrier (63902 = M-Pesa, 63903 = Airtel Money). Kenyan number
// portability means prefix-based detection is best-effort, not
// authoritative — a ported number can defeat this — but it covers the
// overwhelming majority of un-ported SIMs correctly. Unknown prefixes
// fall back to M-Pesa since that's this app's primary/expected network.
const MPESA_NETWORK_CODE = '63902';
const AIRTEL_NETWORK_CODE = '63903';
const AIRTEL_PREFIXES = ['0730', '0731', '0732', '0733', '0734', '0735', '0736', '0737', '0738', '0739',
  '0750', '0751', '0752', '0753', '0754', '0755', '0756', '0785', '0786', '0787', '0788', '0789',
  '0100', '0101', '0102'];

const detectNetworkCode = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/^\+?254/, '0');
  const prefix4 = p.slice(0, 4);
  return AIRTEL_PREFIXES.includes(prefix4) ? AIRTEL_NETWORK_CODE : MPESA_NETWORK_CODE;
};

const initiateSTKPush = async (phone, amount, reference, description = 'Drivenwave Payment') => {
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    channel_id: CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: CALLBACK_URL,
    customer_name: description,
  };

  console.log('[PayHero] STK Push payload:', JSON.stringify(payload));

  try {
    const { data } = await client.post('/payments', payload);
    console.log('[PayHero] STK response:', JSON.stringify(data));
    return data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[PayHero] STK FAILED — status:', err.response?.status, 'body:', JSON.stringify(errData));
    // Throw a clear error with PayHero's actual message
    const msg = typeof errData === 'object'
      ? errData.error_message || errData.message || errData.error || errData.detail || JSON.stringify(errData)
      : errData;
    throw new Error(`PayHero: ${msg}`);
  }
};

const checkTransactionStatus = async (reference) => {
  const { data } = await client.get(`/transaction-status?reference=${encodeURIComponent(reference)}`);
  return data;
};

const initiateWithdrawal = async (phone, amount, reference) => {
  const payload = {
    external_reference: reference,
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    network_code: detectNetworkCode(phone),
    callback_url: CALLBACK_URL,
    channel: 'mobile',
    channel_id: CHANNEL_ID,
    payment_service: 'b2c',
  };

  console.log('[PayHero] Withdrawal payload:', JSON.stringify(payload));
  try {
    const { data } = await client.post('/withdraw', payload);
    console.log('[PayHero] Withdrawal response:', JSON.stringify(data));
    return data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[PayHero] Withdrawal FAILED:', JSON.stringify(errData));
    const msg = typeof errData === 'object'
      ? errData.error_message || errData.message || errData.error || errData.detail || JSON.stringify(errData)
      : errData;
    throw new Error(`PayHero: ${msg}`);
  }
};

module.exports = { initiateSTKPush, checkTransactionStatus, initiateWithdrawal };
