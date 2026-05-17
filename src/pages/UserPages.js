import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// ======================== TASKS PAGE ========================
export const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks').then(r => setTasks(r.data.tasks)).catch(() => toast.error('Failed to load tasks')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading tasks...</div>;

  return (
    <div className="page">
      <h1 className="page-title">WhatsApp Tasks</h1>
      <p className="page-desc">Post these as WhatsApp statuses, collect views, then upload your screenshot to earn.</p>
      {tasks.length === 0 ? <div className="empty">No tasks available right now. Check back soon!</div> : (
        <div className="tasks-grid">
          {tasks.map(task => (
            <div key={task.id} className="task-card">
              {task.image_url && <img src={task.image_url} alt={task.title} className="task-img" />}
              <div className="task-body">
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                {task.my_submission ? (
                  <span className={`submission-badge ${task.my_submission.status}`}>
                    {task.my_submission.status === 'approved' ? `✅ Approved — KES ${task.my_submission.earning_amount}` :
                     task.my_submission.status === 'pending' ? '⏳ Pending Review' : '❌ Rejected'}
                  </span>
                ) : (
                  <span className="task-cta">Post & earn KES 20/view</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ======================== UPLOAD PAGE ========================
export const UploadPage = () => {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ task_id: '', screenshot_url: '', views_count: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/tasks').then(r => {
      const available = r.data.tasks.filter(t => !t.my_submission);
      setTasks(available);
      if (available.length) setForm(f => ({ ...f, task_id: available[0].id }));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/tasks/${form.task_id}/submit`, {
        screenshot_url: form.screenshot_url,
        views_count: parseInt(form.views_count),
      });
      toast.success(`Submitted! Potential earning: KES ${res.data.potential_earning}`);
      setForm(f => ({ ...f, screenshot_url: '', views_count: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Upload Screenshot</h1>
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Task</label>
            <select value={form.task_id} onChange={e => setForm({...form, task_id: e.target.value})} required>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Screenshot URL</label>
            <input type="url" placeholder="https://..." value={form.screenshot_url} onChange={e => setForm({...form, screenshot_url: e.target.value})} required />
            <small>Upload your screenshot to Imgur, Google Drive, or any image host and paste the link here.</small>
          </div>
          <div className="form-group">
            <label>Number of Views</label>
            <input type="number" min="1" placeholder="e.g. 150" value={form.views_count} onChange={e => setForm({...form, views_count: e.target.value})} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !tasks.length}>
            {loading ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ======================== WALLET PAGE ========================
export const WalletPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/wallet').then(r => setTransactions(r.data.transactions)).finally(() => setLoading(false));
  }, []);

  const typeColors = { earning: '#22c55e', referral: '#6366f1', withdrawal: '#ef4444', deposit: '#3b82f6', activation: '#f59e0b', package: '#8b5cf6' };

  return (
    <div className="page">
      <h1 className="page-title">Wallet</h1>
      <div className="balance-card">
        <p>Available Balance</p>
        <h2>KES {Number(user?.wallet_balance || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</h2>
      </div>
      <h2 className="section-title">Transaction History</h2>
      {loading ? <div className="loading">Loading...</div> : (
        <div className="transactions-list">
          {transactions.length === 0 ? <div className="empty">No transactions yet.</div> : transactions.map(txn => (
            <div key={txn.id} className="txn-row">
              <div className="txn-dot" style={{ background: typeColors[txn.type] || '#64748b' }} />
              <div className="txn-info">
                <p className="txn-desc">{txn.description || txn.type}</p>
                <span className="txn-date">{new Date(txn.created_at).toLocaleDateString()}</span>
              </div>
              <div className="txn-amount" style={{ color: ['earning','referral','deposit'].includes(txn.type) ? '#22c55e' : '#ef4444' }}>
                {['earning','referral','deposit'].includes(txn.type) ? '+' : '-'}KES {Number(txn.amount).toLocaleString()}
              </div>
              <span className={`txn-status ${txn.status}`}>{txn.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ======================== DEPOSIT PAGE ========================
export const DepositPage = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments/deposit', { amount: Number(amount) });
      toast.success('STK Push sent! Enter your M-Pesa PIN.');
      setAmount('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Deposit Funds</h1>
      <div className="form-card">
        <p className="form-hint">M-Pesa prompt will be sent to <strong>{user?.phone}</strong></p>
        <form onSubmit={handleDeposit}>
          <div className="form-group">
            <label>Amount (KES)</label>
            <input type="number" min="10" placeholder="e.g. 500" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending STK Push...' : 'Deposit via M-Pesa'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ======================== WITHDRAW PAGE ========================
export const WithdrawPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ amount: '', phone: user?.phone || '' });
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  useEffect(() => {
    api.get('/user/withdrawals').then(r => setWithdrawals(r.data.withdrawals));
  }, []);

  const canWithdraw = ['silver', 'gold'].includes(user?.package_level) && user?.status === 'active';

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments/withdraw-request', { amount: Number(form.amount), phone: form.phone });
      toast.success('Withdrawal request submitted! Processing within 24 hours.');
      setForm(f => ({ ...f, amount: '' }));
      api.get('/user/withdrawals').then(r => setWithdrawals(r.data.withdrawals));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Withdraw Earnings</h1>
      {!canWithdraw && (
        <div className="info-banner">ℹ️ Withdrawals require <strong>Silver or Gold package</strong> and an active account. Minimum KES 1,000.</div>
      )}
      {canWithdraw && (
        <div className="form-card">
          <p className="balance-hint">Available: <strong>KES {Number(user?.wallet_balance || 0).toLocaleString()}</strong></p>
          <form onSubmit={handleWithdraw}>
            <div className="form-group">
              <label>Amount (min KES 1,000)</label>
              <input type="number" min="1000" max={user?.wallet_balance} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>M-Pesa Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </form>
        </div>
      )}
      <h2 className="section-title">Withdrawal History</h2>
      <div className="transactions-list">
        {withdrawals.map(w => (
          <div key={w.id} className="txn-row">
            <div>
              <p>KES {Number(w.amount).toLocaleString()} → {w.phone}</p>
              <span className="txn-date">{new Date(w.requested_at).toLocaleDateString()}</span>
            </div>
            <span className={`txn-status ${w.status}`}>{w.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ======================== PACKAGES PAGE ========================
const PACKAGES = [
  { name: 'starter', price: 100, multiplier: '1x', desc: 'KES 20 per view', color: '#6366f1' },
  { name: 'bronze', price: 500, multiplier: '1.5x', desc: 'KES 30 per view', color: '#cd7f32' },
  { name: 'silver', price: 1500, multiplier: '2x', desc: 'KES 40 per view + withdrawals', color: '#94a3b8' },
  { name: 'gold', price: 2999, multiplier: '3x', desc: 'KES 60 per view + withdrawals', color: '#f59e0b' },
];

export const PackagesPage = () => {
  const { user, refreshUser } = useAuth();
  const [buying, setBuying] = useState(null);

  const handleBuy = async (pkg) => {
    setBuying(pkg);
    try {
      await api.post('/payments/buy-package', { package_name: pkg });
      toast.success('STK Push sent! Enter your M-Pesa PIN.');
      setTimeout(() => refreshUser(), 6000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Buy a Package</h1>
      <p className="page-desc">Upgrade your package to earn more per WhatsApp view.</p>
      <div className="packages-grid">
        {PACKAGES.map(pkg => (
          <div key={pkg.name} className={`package-card ${user?.package_level === pkg.name ? 'active-pkg' : ''}`} style={{ borderColor: pkg.color }}>
            <div className="pkg-name" style={{ color: pkg.color }}>{pkg.name.toUpperCase()}</div>
            <div className="pkg-multiplier">{pkg.multiplier} earnings</div>
            <div className="pkg-price">KES {pkg.price.toLocaleString()}</div>
            <div className="pkg-desc">{pkg.desc}</div>
            {user?.package_level === pkg.name ? (
              <span className="current-pkg">✅ Current Package</span>
            ) : (
              <button className="btn-pkg" style={{ background: pkg.color }} onClick={() => handleBuy(pkg.name)} disabled={buying === pkg.name}>
                {buying === pkg.name ? 'Sending STK...' : 'Buy Now'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ======================== REFERRALS PAGE ========================
export const ReferralsPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/user/referrals').then(r => setData(r.data));
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  return (
    <div className="page">
      <h1 className="page-title">Referrals</h1>
      <div className="referral-card">
        <p>Your Referral Code</p>
        <h2 className="ref-code">{user?.referral_code}</h2>
        <input className="ref-link" value={referralLink} readOnly />
        <button className="btn-primary" onClick={copyLink}>Copy Referral Link</button>
      </div>

      <div className="ref-bonuses">
        <h3>Referral Bonuses</h3>
        <div className="bonus-row"><span>Registration</span><strong>KES 50</strong></div>
        <div className="bonus-row"><span>Activation</span><strong>KES 100</strong></div>
        <div className="bonus-row"><span>Package Purchase</span><strong>KES 150</strong></div>
      </div>

      {data && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div><p className="stat-label">Total Referrals</p><h3>{data.referrals?.length || 0}</h3></div></div>
            <div className="stat-card"><div><p className="stat-label">Total Earned</p><h3>KES {Number(data.total_earned || 0).toLocaleString()}</h3></div></div>
          </div>
          <h2 className="section-title">My Referrals</h2>
          <div className="transactions-list">
            {data.referrals?.map(r => (
              <div key={r.id} className="txn-row">
                <div>
                  <p>{r.full_name}</p>
                  <span className="txn-date">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <span className={`txn-status ${r.status}`}>{r.package_level?.toUpperCase()} · {r.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ======================== PROFILE PAGE ========================
export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/user/profile', form);
      await refreshUser();
      toast.success('Profile updated!');
    } catch {
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>
      <div className="form-card">
        <div className="profile-header">
          <div className="profile-avatar">{user?.full_name?.[0]?.toUpperCase()}</div>
          <div>
            <p><strong>{user?.email}</strong></p>
            <p>Member since {new Date(user?.created_at || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={user?.email} disabled />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};
