const express = require('express');
const router = express.Router();
const supabase = require('./supabase');
const { authenticate, requireAdmin } = require('./auth');
const { initiateWithdrawal } = require('./payhero');

router.use(authenticate, requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    const [users, tasks, submissions, withdrawals, transactions] = await Promise.all([
      supabase.from('users').select('id, status, package_level, wallet_balance, created_at'),
      supabase.from('tasks').select('id, is_active'),
      supabase.from('task_submissions').select('id, status, earning_amount'),
      supabase.from('withdrawals').select('id, status, amount'),
      supabase.from('transactions').select('id, type, amount, status'),
    ]);

    const totalUsers = users.data?.length || 0;
    const activeUsers = users.data?.filter(u => u.status === 'active').length || 0;
    const pendingSubmissions = submissions.data?.filter(s => s.status === 'pending').length || 0;
    const pendingWithdrawals = withdrawals.data?.filter(w => w.status === 'pending').length || 0;
    const totalPaid = withdrawals.data?.filter(w => w.status === 'paid').reduce((a, b) => a + Number(b.amount), 0) || 0;

    res.json({ totalUsers, activeUsers, pendingSubmissions, pendingWithdrawals, totalPaid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

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

router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, wallet_balance, package_level, role } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (wallet_balance !== undefined) updates.wallet_balance = wallet_balance;
    if (package_level) updates.package_level = package_level;
    if (role) updates.role = role;

    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'User updated', user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tasks: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { title, description, image_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const { data, error } = await supabase.from('tasks').insert({ title, description, image_url }).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Task created', task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, is_active } = req.body;
    const { data, error } = await supabase.from('tasks').update({ title, description, image_url, is_active }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'Task updated', task: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await supabase.from('tasks').delete().eq('id', req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

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

router.patch('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const { data: submission } = await supabase.from('task_submissions').select('*').eq('id', id).single();
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    await supabase.from('task_submissions').update({ status, admin_note, reviewed_at: new Date().toISOString() }).eq('id', id);

    if (status === 'approved') {
      const { data: user } = await supabase.from('users').select('wallet_balance').eq('id', submission.user_id).single();
      const newBalance = Number(user.wallet_balance) + Number(submission.earning_amount);
      await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', submission.user_id);
      await supabase.from('transactions').insert({
        user_id: submission.user_id,
        type: 'earning',
        amount: submission.earning_amount,
        status: 'completed',
        description: 'Task earning approved',
      });
    }

    res.json({ message: `Submission ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*, users(full_name, phone, package_level, status)')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    res.json({ withdrawals: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

router.patch('/withdrawals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_note } = req.body;

    const { data: withdrawal } = await supabase.from('withdrawals').select('*, users(*)').eq('id', id).single();
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (action === 'approve') {
      const reference = `WD-${id.slice(0, 8)}-${Date.now()}`;
      await initiateWithdrawal(withdrawal.phone, withdrawal.amount, reference);
      await supabase.from('withdrawals').update({ status: 'paid', admin_note, processed_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('transactions').update({ status: 'completed' }).eq('user_id', withdrawal.user_id).eq('type', 'withdrawal').eq('status', 'pending');
      res.json({ message: 'Withdrawal approved and M-Pesa payout initiated' });
    } else if (action === 'reject') {
      await supabase.from('users').update({ wallet_balance: withdrawal.users.wallet_balance + withdrawal.amount }).eq('id', withdrawal.user_id);
      await supabase.from('withdrawals').update({ status: 'rejected', admin_note, processed_at: new Date().toISOString() }).eq('id', id);
      res.json({ message: 'Withdrawal rejected. Amount refunded to wallet.' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Admin withdrawal error:', err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, users(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ transactions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
