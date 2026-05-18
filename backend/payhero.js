const axios = require('axios');

const PAYHERO_BASE = 'https://backend.payhero.co.ke/api/v2';
const CALLBACK_URL = process.env.PAYHERO_CALLBACK_URL;
const CHANNEL_ID = parseInt(process.env.PAYHERO_CHANNEL_ID);

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

const normalizePhone = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
};

const initiateSTKPush = async (phone, amount, reference, description = 'Kadem Payment') => {
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
  console.log('[PayHero] Auth header prefix:', AUTH_HEADER.slice(0, 20) + '...');

  try {
    const { data } = await client.post('/payments', payload);
    console.log('[PayHero] STK response:', JSON.stringify(data));
    return data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[PayHero] STK FAILED — status:', err.response?.status, 'body:', JSON.stringify(errData));
    // Throw a clear error with PayHero's actual message
    const msg = typeof errData === 'object'
      ? errData.message || errData.error || errData.detail || JSON.stringify(errData)
      : errData;
    throw new Error(`PayHero: ${msg}`);
  }
};

const checkTransactionStatus = async (reference) => {
  const { data } = await client.get(`/transaction-status?reference=${reference}`);
  return data;
};

const initiateWithdrawal = async (phone, amount, reference) => {
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    channel_id: CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: CALLBACK_URL,
    customer_name: 'Kadem Withdrawal',
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
      ? errData.message || errData.error || errData.detail || JSON.stringify(errData)
      : errData;
    throw new Error(`PayHero: ${msg}`);
  }
};

module.exports = { initiateSTKPush, checkTransactionStatus, initiateWithdrawal };
