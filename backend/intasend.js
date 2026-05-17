const IntaSend = require('intasend-node');

/**
 * IntaSend Payment Client
 * Docs: https://developers.intasend.com
 *
 * IMPORTANT — If you get "Host not in allowlist" error:
 * 1. Go to https://app.intasend.com
 * 2. Settings → API Keys & Webhooks
 * 3. Under "Allowed IPs / Hosts", add your Render backend IP
 *    (Find it in Render → your service → Settings → IP Address)
 * 4. Also add webhook URL: https://kadem-api.onrender.com/api/payments/callback
 */

const getClient = () => new IntaSend({
  publishable_key: process.env.INTASEND_PUBLISHABLE_KEY,
  secret_key: process.env.INTASEND_SECRET_KEY,
  test_mode: false,
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
    api_ref: reference,
    narrative: `Kadem - ${customerName || 'Payment'}`,
  };

  console.log('[IntaSend] STK Push payload:', JSON.stringify(payload));

  try {
    const client = getClient();
    const response = await client.collection().mpesaStkPush(payload);
    console.log('[IntaSend] STK Success:', JSON.stringify(response));
    return response;
  } catch (err) {
    // Extract meaningful error
    let errMsg = err.message || 'Unknown error';
    if (err.response?.data) {
      errMsg = JSON.stringify(err.response.data);
    }
    // Special case: host not whitelisted
    if (errMsg.includes('allowlist') || errMsg.includes('whitelist') || err.response?.status === 403) {
      errMsg = 'HOST_NOT_WHITELISTED: Add your Render IP to IntaSend allowed hosts at app.intasend.com';
    }
    console.error('[IntaSend] STK FAILED:', errMsg);
    throw new Error(errMsg);
  }
};

const initiateWithdrawal = async (phone, amount, reference) => {
  const payload = {
    currency: 'KES',
    transactions: [{
      name: 'Kadem Withdrawal',
      account: normalizePhone(phone),
      amount: Math.round(Number(amount)),
      narrative: reference,
    }],
  };

  console.log('[IntaSend] Withdrawal payload:', JSON.stringify(payload));

  try {
    const client = getClient();
    const initiated = await client.payouts().mpesa(payload);
    console.log('[IntaSend] Withdrawal initiated:', JSON.stringify(initiated));
    const approved = await client.payouts().approve(initiated);
    console.log('[IntaSend] Withdrawal approved:', JSON.stringify(approved));
    return approved;
  } catch (err) {
    let errMsg = err.message || 'Unknown error';
    if (err.response?.data) errMsg = JSON.stringify(err.response.data);
    if (errMsg.includes('allowlist') || errMsg.includes('whitelist') || err.response?.status === 403) {
      errMsg = 'HOST_NOT_WHITELISTED: Add your Render IP to IntaSend allowed hosts';
    }
    console.error('[IntaSend] Withdrawal FAILED:', errMsg);
    throw new Error(errMsg);
  }
};

module.exports = { initiateSTKPush, initiateWithdrawal };
