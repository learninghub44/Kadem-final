const IntaSend = require('intasend-node');

/**
 * IntaSend Payment Client
 * Docs: https://developers.intasend.com
 * Keys from: https://app.intasend.com/account/api-keys/
 */

const getClient = () => new IntaSend({
  publishable_key: process.env.INTASEND_PUBLISHABLE_KEY,
  secret_key: process.env.INTASEND_SECRET_KEY,
  test_mode: false, // live mode
});

const normalizePhone = (phone) => {
  let p = phone.toString().trim().replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
};

/**
 * M-Pesa STK Push (collect from customer)
 */
const initiateSTKPush = async (phone, amount, reference, customerName) => {
  const client = getClient();
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    api_ref: reference,
    narrative: customerName || 'Kadem Payment',
  };

  console.log('[IntaSend] STK Push:', JSON.stringify(payload));
  try {
    const response = await client.collection().mpesaStkPush(payload);
    console.log('[IntaSend] STK Response:', JSON.stringify(response));
    return response;
  } catch (err) {
    const errData = err.response?.data || err.message || err;
    console.error('[IntaSend] STK FAILED:', JSON.stringify(errData));
    throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : errData);
  }
};

/**
 * M-Pesa B2C Payout (send to customer — for withdrawals)
 */
const initiateWithdrawal = async (phone, amount, reference) => {
  const client = getClient();
  const payload = {
    currency: 'KES',
    transactions: [
      {
        name: 'Kadem Withdrawal',
        account: normalizePhone(phone),
        amount: Math.round(Number(amount)),
        narrative: reference,
      }
    ],
  };

  console.log('[IntaSend] Withdrawal:', JSON.stringify(payload));
  try {
    // initiate the batch
    const initiated = await client.payouts().mpesa(payload);
    console.log('[IntaSend] Withdrawal initiated:', JSON.stringify(initiated));
    // approve immediately
    const approved = await client.payouts().approve(initiated);
    console.log('[IntaSend] Withdrawal approved:', JSON.stringify(approved));
    return approved;
  } catch (err) {
    const errData = err.response?.data || err.message || err;
    console.error('[IntaSend] Withdrawal FAILED:', JSON.stringify(errData));
    throw new Error(typeof errData === 'object' ? JSON.stringify(errData) : errData);
  }
};

module.exports = { initiateSTKPush, initiateWithdrawal };
