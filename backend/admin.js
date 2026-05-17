const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { authenticate, requireAdmin } = require('./auth');
const { initiateWithdrawal } = require('./payhero');

router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [users, submissions, withdrawals, transactions] = await Promise.all([
      supabase.from('users').select('id, status, package_level, wallet_balance, created_at'),
      supabase.from('task_submissions').select('id, status, earning_amount'),
      supabase.from('withdrawals').select('id, status, amount'),
      supabase.from('transactions').select('id, type, amount, status'),
    ]);
    const totalUsers = users.data?.length || 0;
    const activeUsers = users.data?.filter(u => u.status === 'active').length || 0;
    const pendingSubmissions = submissions.data?.filter(s => s.status === 'pending').length || 0;
    const pendingWithdrawals = withdrawals.data?.filter(w => w.status === 'pending').length || 0;
    const totalPaid = withdrawals.data?.filter(w => w.status === 'paid').reduce((a, b) => a + Number(b.amount), 0) || 0;
    const totalRevenue = transactions.data?.filter(t => t.status === 'completed' && ['activation','package','deposit'].includes(t.type)).reduce((a, b) => a + Number(b.amount), 0) || 0;
    res.json({ totalUsers, activeUsers, pendingSubmissions, pendingWithdrawals, totalPaid, totalRevenue });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, status, wallet_balance, package_level, role } = req.body;
    const updates = {};
    if (full_name) updates.full_name = full_name.trim();
    if (phone) updates.phone = phone.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (status && ['active','inactive','suspended'].includes(status)) updates.status = status;
    if (wallet_balance !== undefined) updates.wallet_balance = Number(wallet_balance);
    if (package_level && ['none','starter','bronze','silver','gold'].includes(package_level)) updates.package_level = package_level;
    if (role && ['user','admin'].includes(role)) updates.role = role;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'User updated', user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/tasks
router.get('/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tasks: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/admin/tasks
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, image_url } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Task title is required' });
    const { data, error } = await supabase.from('tasks').insert({ title: title.trim(), description, image_url }).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Task created', task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/admin/tasks/:id
router.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, is_active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (image_url !== undefined) updates.image_url = image_url;
    if (is_active !== undefined) updates.is_active = is_active;
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'Task updated', task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/admin/tasks/:id
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET /api/admin/submissions
router.get('/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('task_submissions')
      .select('*, users(full_name, phone, package_level), tasks(title)')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    res.json({ submissions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// PATCH /api/admin/submissions/:id
router.patch('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status must be approved or rejected' });

    const { data: submission } = await supabase.from('task_submissions').select('*').eq('id', id).maybeSingle();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status !== 'pending') return res.status(400).json({ error: 'Submission already reviewed' });

    await supabase.from('task_submissions').update({
      status, admin_note: admin_note || null, reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    if (status === 'approved') {
      const { data: user } = await supabase.from('users').select('wallet_balance').eq('id', submission.user_id).single();
      await supabase.from('users').update({ wallet_balance: Number(user.wallet_balance) + Number(submission.earning_amount) }).eq('id', submission.user_id);
      await supabase.from('transactions').insert({
        user_id: submission.user_id, type: 'earning',
        amount: submission.earning_amount, status: 'completed',
        description: 'Task screenshot approved',
      });
    }
    res.json({ message: `Submission ${status} successfully` });
  } catch (err) {
    console.error('Review submission error:', err);
    res.status(500).json({ error: 'Failed to review submission' });
  }
});

// GET /api/admin/withdrawals
router.get('/withdrawals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*, users(full_name, phone, package_level, status, wallet_balance)')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    res.json({ withdrawals: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// PATCH /api/admin/withdrawals/:id
router.patch('/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_note } = req.body;
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'Action must be approve or reject' });

    const { data: withdrawal } = await supabase.from('withdrawals').select('*, users(*)').eq('id', id).maybeSingle();
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Withdrawal already processed' });

    if (action === 'approve') {
      const reference = `WD-${id.slice(0, 8)}-${Date.now()}`;
      try {
        await initiateWithdrawal(withdrawal.phone, withdrawal.amount, reference);
      } catch (payErr) {
        console.error('Withdrawal payout error:', payErr.response?.data || payErr.message);
        return res.status(502).json({ error: 'M-Pesa payout failed. Withdrawal not processed.', details: payErr.response?.data });
      }
      await supabase.from('withdrawals').update({ status: 'paid', admin_note: admin_note || null, processed_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('transactions').update({ status: 'completed' })
        .eq('user_id', withdrawal.user_id).eq('type', 'withdrawal').eq('status', 'pending');
      res.json({ message: 'Withdrawal approved — M-Pesa payout sent' });
    } else {
      // Refund wallet
      await supabase.from('users').update({
        wallet_balance: Number(withdrawal.users.wallet_balance) + Number(withdrawal.amount),
      }).eq('id', withdrawal.user_id);
      await supabase.from('withdrawals').update({ status: 'rejected', admin_note: admin_note || null, processed_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('transactions').update({ status: 'failed' })
        .eq('user_id', withdrawal.user_id).eq('type', 'withdrawal').eq('status', 'pending');
      res.json({ message: 'Withdrawal rejected — amount refunded to user wallet' });
    }
  } catch (err) {
    console.error('Admin withdrawal error:', err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// PATCH /api/admin/transactions/:id (mark failed/completed manually)
router.patch('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, user_id } = req.body;
    if (!['completed', 'failed'].includes(status))
      return res.status(400).json({ error: 'Status must be completed or failed' });

    const { data: txn } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    await supabase.from('transactions').update({ status }).eq('id', id);

    // If manually completing an activation, also activate the user
    if (status === 'completed' && txn.type === 'activation') {
      await supabase.from('users').update({ status: 'active' }).eq('id', txn.user_id);
    }

    res.json({ message: `Transaction marked as ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, users(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    res.json({ transactions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});


// POST /api/admin/users — add user manually
router.post('/users', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { full_name, phone, email, password, status, package_level, wallet_balance, role } = req.body;
    if (!full_name || !phone || !email || !password)
      return res.status(400).json({ error: 'full_name, phone, email, password required' });

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const { data: existingPhone } = await supabase.from('users').select('id').eq('phone', phone.trim()).maybeSingle();
    if (existingPhone) return res.status(409).json({ error: 'Phone already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let referral_code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: user, error } = await supabase.from('users').insert({
      full_name: full_name.trim(), phone: phone.trim(),
      email: email.toLowerCase().trim(), password_hash, referral_code,
      status: status || 'active',
      package_level: package_level || 'none',
      wallet_balance: Number(wallet_balance || 0),
      role: role || 'user',
    }).select('id, full_name, phone, email, status, wallet_balance, package_level, role, referral_code').single();

    if (error) throw error;
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    console.error('Add user error:', err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/users/:id/referrals
router.get('/users/:id/referrals', async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('referral_code').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { data: referrals } = await supabase.from('users')
      .select('id, full_name, phone, email, status, package_level, created_at')
      .eq('referred_by', user.referral_code)
      .order('created_at', { ascending: false });
    res.json({ referrals: referrals || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

module.exports = router;
