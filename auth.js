const jwt = require('jsonwebtoken');
const supabase = require('./supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code')
      .eq('id', decoded.userId)
      .single();
    if (error || !user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireActive = (req, res, next) => {
  if (req.user?.status !== 'active') return res.status(403).json({ error: 'Account not activated. Pay KES 550 to activate.' });
  next();
};

module.exports = { authenticate, requireAdmin, requireActive };
