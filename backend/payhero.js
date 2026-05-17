const axios = require('axios');

const payHeroClient = axios.create({
  baseURL: process.env.PAYHERO_API_URL,
  auth: {
    username: process.env.PAYHERO_USERNAME,
    password: process.env.PAYHERO_PASSWORD,
  },
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Initiate STK Push via PayHero
 * @param {string} phone - Kenyan phone number e.g. 0712345678
 * @param {number} amount - Amount in KES
 * @param {string} reference - Unique reference for this transaction
 * @param {string} description - Payment description
 */
const initiateSTKPush = async (phone, amount, reference, description) => {
  // Normalize phone to 254 format
  const normalized = phone.replace(/^0/, '254').replace(/^\+/, '');

  const payload = {
    amount,
    phone_number: normalized,
    channel_id: process.env.PAYHERO_CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    customer_name: description,
    callback_url: process.env.PAYHERO_CALLBACK_URL,
  };

  const response = await payHeroClient.post('/payments', payload);
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
    channel_id: process.env.PAYHERO_CHANNEL_ID,
    provider: 'm-pesa',
    external_reference: reference,
    callback_url: process.env.PAYHERO_CALLBACK_URL,
  };

  const response = await payHeroClient.post('/withdraw', payload);
  return response.data;
};

module.exports = { initiateSTKPush, initiateWithdrawal };
