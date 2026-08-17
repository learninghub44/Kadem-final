const jwt = require('jsonwebtoken');
const supabase = require('./supabase');

// In-memory user cache: userId → { user, expiresAt }
const userCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

const getCachedUser = (userId) => {
  const entry = userCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.user;
  userCache.delete(userId);
  return null;
};

const setCachedUser = (userId, user) => {
  userCache.set(userId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
};

const invalidateUserCache = (userId) => {
  userCache.delete(userId);
};

// Periodically clean expired entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (now >= entry.expiresAt) userCache.delete(key);
  }
}, 60000);

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check cache first
    let user = getCachedUser(decoded.userId);

    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code')
        .eq('id', decoded.userId)
        .single();
      if (error || !data) return res.status(401).json({ error: 'User not found' });
      user = data;
      setCachedUser(user.id, user);
    }

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
  if (req.user?.status !== 'active') return res.status(403).json({ error: 'Account not activated. Pay KES 150 to activate.' });
  next();
};

module.exports = { authenticate, requireAdmin, requireActive, invalidateUserCache };
