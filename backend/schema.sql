-- ============================================
-- KADEM MARKETING AGENCY — SUPABASE SCHEMA
-- ============================================

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES users(referral_code),
  status TEXT DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'suspended')),
  wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
  package_level TEXT DEFAULT 'none' CHECK (package_level IN ('none', 'starter', 'bronze', 'silver', 'gold')),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PACKAGES
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  earnings_multiplier NUMERIC(4, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO packages (name, price, earnings_multiplier) VALUES
  ('starter', 100, 1.0),
  ('bronze',  500, 1.5),
  ('silver', 1500, 2.0),
  ('gold',   2999, 3.0);

-- TASKS
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASK SUBMISSIONS
CREATE TABLE task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  screenshot_url TEXT NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 0,
  earning_amount NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, task_id)
);

-- TRANSACTIONS
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('activation', 'package', 'deposit', 'withdrawal', 'earning', 'referral')),
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  mpesa_code TEXT,
  payhero_reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WITHDRAWALS
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_note TEXT,
  payhero_reference TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- REFERRAL EARNINGS LOG
CREATE TABLE referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('registration', 'activation', 'package')),
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_task_submissions_user_id ON task_submissions(user_id);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);

-- ATOMIC WALLET INCREMENT FUNCTION
-- Use this instead of read-modify-write to prevent race conditions
CREATE OR REPLACE FUNCTION increment_wallet(user_id UUID, amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE users
  SET wallet_balance = wallet_balance + amount
  WHERE id = user_id
  RETURNING wallet_balance INTO new_balance;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
