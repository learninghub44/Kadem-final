const IntaSend = require('intasend-node');

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

const parseIntaSendError = (err) => {
  // SDK rejects with a Buffer on HTTP errors
  if (Buffer.isBuffer(err)) {
    try { return JSON.stringify(JSON.parse(err.toString())); }
    catch { return err.toString(); }
  }
  if (err?.response?.data) return JSON.stringify(err.response.data);
  if (typeof err === 'string') return err;
  return err?.message || JSON.stringify(err);
};

const initiateSTKPush = async (phone, amount, reference, customerName) => {
  const payload = {
    amount: Math.round(Number(amount)),
    phone_number: normalizePhone(phone),
    api_ref: reference,
    narrative: `Kadem - ${customerName || 'Payment'}`,
  };

  console.log('[IntaSend] STK Push:', JSON.stringify(payload));
  try {
    const response = await getClient().collection().mpesaStkPush(payload);
    console.log('[IntaSend] STK Success:', JSON.stringify(response));
    return response;
  } catch (err) {
    const msg = parseIntaSendError(err);
    console.error('[IntaSend] STK FAILED:', msg);
    throw new Error(msg);
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

  console.log('[IntaSend] Withdrawal:', JSON.stringify(payload));
  try {
    const client = getClient();
    const initiated = await client.payouts().mpesa(payload);
    const approved = await client.payouts().approve(initiated);
    console.log('[IntaSend] Withdrawal approved:', JSON.stringify(approved));
    return approved;
  } catch (err) {
    const msg = parseIntaSendError(err);
    console.error('[IntaSend] Withdrawal FAILED:', msg);
    throw new Error(msg);
  }
};

module.exports = { initiateSTKPush, initiateWithdrawal };
