const axios = require('axios');

// PayHero client using Authorization header (Basic token method)
const payHeroClient = axios.create({
  baseURL: process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke/api/v2/',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.PAYHERO_AUTHORIZATION, // e.g. "Basic YOUR_BASE64_TOKEN"
  },
});

/**
 * Initiate STK Push via PayHero
 */
const initiateSTKPush = async (phone, amount, reference, description) => {
  const normalized = phone.replace(/^0/, '254').replace(/^\+/, '');

  const payload = {
    amount,
    phone_number: normalized,
    channel_id: parseInt(process.env.PAYHERO_CHANNEL_ID),
    provider: process.env.PAYHERO_PROVIDER || 'm-pesa',
    external_reference: reference,
    customer_name: description,
    callback_url: process.env.PAYHERO_CALLBACK_URL,
    currency: process.env.PAYHERO_CURRENCY || 'KES',
  };

  console.log('PayHero STK Push payload:', JSON.stringify(payload));
  const response = await payHeroClient.post('payments', payload);
  console.log('PayHero STK Push response:', JSON.stringify(response.data));
  return response.data;
};

/**
 * Initiate B2C payout via PayHero (for withdrawals)
 */
const initiateWithdrawal = async (phone, amount, reference) => {
  const normalized = phone.replace(/^0/, '254').replace(/^\+/, '');

  const payload = {
    amount,
    phone_number: normalized,
    channel_id: parseInt(process.env.PAYHERO_CHANNEL_ID),
    provider: process.env.PAYHERO_PROVIDER || 'm-pesa',
    external_reference: reference,
    callback_url: process.env.PAYHERO_CALLBACK_URL,
    currency: process.env.PAYHERO_CURRENCY || 'KES',
  };

  console.log('PayHero Withdrawal payload:', JSON.stringify(payload));
  const response = await payHeroClient.post('withdraw', payload);
  console.log('PayHero Withdrawal response:', JSON.stringify(response.data));
  return response.data;
};

module.exports = { initiateSTKPush, initiateWithdrawal };
