const axios = require('axios');

/**
 * PayHero API Client
 * Auth: Basic base64(username:password) passed as Authorization header
 * HOW TO GENERATE: Buffer.from('username:password').toString('base64')
 * Set env: PAYHERO_AUTHORIZATION=Basic <base64_result>
 */

const payhero = axios.create({
  baseURL: 'https://backend.payhero.co.ke/api/v2/',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.PAYHERO_AUTHORIZATION,
  },
  timeout: 30000,
});

const normalizePhone = (phone) => {
  let p = phone.toString().trim().replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
};

const initiateSTKPush = async (phone, amount, reference, customerName) => {
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    channel_id: Number(process.env.PAYHERO_CHANNEL_ID),
    provider: 'm-pesa',
    external_reference: reference,
    customer_name: customerName || 'Kadem User',
    callback_url: process.env.PAYHERO_CALLBACK_URL,
  };

  console.log('[PayHero] STK Push:', JSON.stringify(payload));
  try {
    const response = await payhero.post('payments', payload);
    console.log('[PayHero] Response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[PayHero] FAILED:', JSON.stringify(errData));
    throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : errData);
  }
};

const initiateWithdrawal = async (phone, amount, reference) => {
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    channel_id: Number(process.env.PAYHERO_CHANNEL_ID),
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: process.env.PAYHERO_CALLBACK_URL,
  };

  console.log('[PayHero] Withdrawal:', JSON.stringify(payload));
  try {
    const response = await payhero.post('withdraw', payload);
    console.log('[PayHero] Withdrawal response:', JSON.stringify(response.data));
    return response.data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[PayHero] Withdrawal FAILED:', JSON.stringify(errData));
    throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : errData);
  }
};

module.exports = { initiateSTKPush, initiateWithdrawal };
