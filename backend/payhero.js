const axios = require('axios');

const PAYHERO_BASE = 'https://backend.payhero.co.ke/api/v2';
const AUTH_HEADER = `Basic ${process.env.PAYHERO_BASIC_AUTH}`;
const CHANNEL_ID = parseInt(process.env.PAYHERO_CHANNEL_ID);
const CALLBACK_URL = process.env.PAYHERO_CALLBACK_URL;

const client = axios.create({
  baseURL: PAYHERO_BASE,
  headers: {
    'Authorization': AUTH_HEADER,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Initiate M-Pesa STK Push
 */
const initiateSTKPush = async (phone, amount, reference, description = 'Kadem Payment') => {
  // Normalize phone — PayHero expects 07XXXXXXXX or 2547XXXXXXXX
  let normalizedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.slice(1);

  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizedPhone,
    channel_id: CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: CALLBACK_URL,
    customer_name: description,
  };

  console.log('PayHero STK Push:', { phone: normalizedPhone, amount, reference });

  try {
    const { data } = await client.post('/payments', payload);
    console.log('PayHero response:', data);
    return data;
  } catch (err) {
    console.error('PayHero STK error:', err.response?.data || err.message);
    throw err;
  }
};

/**
 * Check transaction status by PayHero reference
 */
const checkTransactionStatus = async (reference) => {
  const { data } = await client.get(`/transaction-status?reference=${reference}`);
  return data;
};

/**
 * Initiate withdrawal (B2C / withdrawal payout)
 * PayHero uses the same /payments endpoint — check their docs for withdrawal channel
 */
const initiateWithdrawal = async (phone, amount, reference) => {
  let normalizedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.slice(1);

  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizedPhone,
    channel_id: CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: CALLBACK_URL,
    customer_name: 'Kadem Withdrawal',
  };

  console.log('PayHero Withdrawal:', { phone: normalizedPhone, amount, reference });

  const { data } = await client.post('/withdraw', payload);
  console.log('PayHero withdrawal response:', data);
  return data;
};

module.exports = { initiateSTKPush, checkTransactionStatus, initiateWithdrawal };
