import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

const WA_CHANNEL = 'https://whatsapp.com/channel/0029VbD1tzELdQedEpwZ5841';

const WaBanner = () => (
  <a href={WA_CHANNEL} target="_blank" rel="noreferrer" className="wa-banner">
    <span className="wa-icon">📣</span>
    <div style={{ flex: 1 }}>
      <strong>Join our WhatsApp Channel</strong>
      <p>Get notified of new tasks & bonuses instantly</p>
    </div>
    <span className="wa-join">Join →</span>
  </a>
);

const LockedGuard = ({ children }) => {
  const { user } = useAuth();
  if (user?.status !== 'active') return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
      <Lock size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
      <h2 style={{ color: '#f59e0b' }}>Feature Locked</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Activate your account to access this feature.</p>
      <a href="/dashboard" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>← Go Activate</a>
    </div>
  );
  return children;
};

// ── TASKS PAGE ─────────────────────────────────────────────────
export const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks').then(r => setTasks(r.data.tasks)).catch(() => toast.error('Failed to load tasks')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading tasks...</div>;

  return (
    <LockedGuard>
      <div className="page">
        <WaBanner />
        <h1 className="page-title">WhatsApp Tasks</h1>
        <p className="page-desc">Post these images as your WhatsApp status, collect views, then upload a screenshot photo to earn.</p>
        {tasks.length === 0
          ? <div className="empty">No tasks available right now. Check back soon!</div>
          : <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  {task.image_url && <img src={task.image_url} alt={task.title} className="task-img" />}
                  <div className="task-body">
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    {task.my_submission ? (
                      <span className={`submission-badge ${task.my_submission.status}`}>
                        {task.my_submission.status === 'approved' ? `✅ Approved — KES ${task.my_submission.earning_amount}` :
                         task.my_submission.status === 'pending' ? '⏳ Pending Admin Review' : '❌ Rejected'}
                      </span>
                    ) : (
                      <a href="/dashboard/upload" className="task-cta-btn">📤 Submit Screenshot</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </LockedGuard>
  );
};

// ── UPLOAD PAGE ────────────────────────────────────────────────
export const UploadPage = () => {
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState('');
  const [views, setViews] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/tasks').then(r => {
      const available = r.data.tasks.filter(t => !t.my_submission || t.my_submission.status === 'rejected');
      setTasks(available);
      if (available.length) setTaskId(available[0].id);
    }).catch(() => {});
  }, []);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return; }
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile) { toast.error('Please select a screenshot photo'); return; }
    if (!views || parseInt(views) < 1) { toast.error('Enter the number of views'); return; }
    setLoading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(photoFile);
      });
      const tid = taskId || (tasks[0]?.id);
      const resp = await api.post(`/tasks/${tid}/submit`, {
        screenshot_base64: base64,
        screenshot_mime: photoFile.type,
        views_count: parseInt(views),
      });
      toast.success(`✅ Submitted! Potential earning: KES ${resp.data.potential_earning}`);
      setViews('');
      setPhotoFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally { setLoading(false); }
  };

  return (
    <LockedGuard>
      <div className="page">
        <WaBanner />
        <h1 className="page-title">Upload Screenshot</h1>
        <div className="info-banner" style={{ marginBottom: 16 }}>
          📸 Take a <strong>real screenshot</strong> of your WhatsApp status views and upload the photo. Links are not accepted.
        </div>
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Screenshot Photo <span style={{ color: '#ef4444' }}>*</span></label>
              <div className="photo-upload-area" onClick={() => fileRef.current?.click()}>
                {preview
                  ? <img src={preview} alt="Preview" className="photo-preview" />
                  : <div className="photo-placeholder">
                      <span>📷</span>
                      <p>Tap to select screenshot</p>
                      <small>JPG, PNG — max 5MB</small>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              {photoFile && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <small style={{ color: '#22c55e' }}>✅ {photoFile.name}</small>
                  <button type="button" className="btn-sm red" onClick={() => { setPhotoFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Number of Views in Screenshot</label>
              <input type="number" min="1" max="10000" placeholder="e.g. 150" value={views} onChange={e => setViews(e.target.value)} required />
              <small style={{ color: '#64748b' }}>Enter the exact views count shown in your screenshot.</small>
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !photoFile}>
              {loading ? '⏳ Uploading...' : '📤 Submit for Review'}
            </button>
          </form>
        </div>
      </div>
    </LockedGuard>
  );
};

// ── WALLET PAGE ────────────────────────────────────────────────
export const WalletPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/wallet').then(r => setTransactions(r.data.transactions || [])).finally(() => setLoading(false));
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
          {transactions.length === 0
            ? <div className="empty">No transactions yet.</div>
            : transactions.map(txn => (
              <div key={txn.id} className="txn-row">
                <div className="txn-dot" style={{ background: typeColors[txn.type] || '#64748b' }} />
                <div className="txn-info">
                  <p className="txn-desc">{txn.description || txn.type}</p>
                  <span className="txn-date">{new Date(txn.created_at).toLocaleDateString()}</span>
                </div>
                <div className="txn-amount" style={{ color: ['earning', 'referral', 'deposit'].includes(txn.type) ? '#22c55e' : '#ef4444' }}>
                  {['earning', 'referral', 'deposit'].includes(txn.type) ? '+' : '-'}KES {Number(txn.amount).toLocaleString()}
                </div>
                <span className={`badge ${txn.status}`}>{txn.status}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

// ── DEPOSIT PAGE ───────────────────────────────────────────────
export const DepositPage = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments/deposit', { amount: Number(amount) });
      toast.success('✅ STK Push sent! Enter your M-Pesa PIN.');
      setAmount('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deposit failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Deposit Funds</h1>
      <div className="form-card" style={{ maxWidth: '100%' }}>
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

// ── WITHDRAW PAGE ──────────────────────────────────────────────
export const WithdrawPage = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ amount: '', phone: user?.phone || '' });
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);

  const loadWithdrawals = useCallback(() => {
    api.get('/user/withdrawals').then(r => setWithdrawals(r.data.withdrawals || []));
  }, []);
  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const canWithdraw = user?.status === 'active';

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments/withdraw-request', { amount: Number(form.amount), phone: form.phone });
      toast.success('Withdrawal request submitted! Processing within 24 hours.');
      setForm(f => ({ ...f, amount: '' }));
      loadWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Withdraw Earnings</h1>
      {!canWithdraw && <div className="info-banner">ℹ️ Activate your account to request withdrawals.</div>}
      {canWithdraw && (
        <div className="form-card" style={{ maxWidth: '100%' }}>
          <p className="balance-hint">Available: <strong>KES {Number(user?.wallet_balance || 0).toLocaleString()}</strong></p>
          <form onSubmit={handleWithdraw}>
            <div className="form-group">
              <label>Amount (min KES 1,000)</label>
              <input type="number" min="1000" max={user?.wallet_balance} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>M-Pesa Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
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
            <div className="txn-info">
              <p className="txn-desc">KES {Number(w.amount).toLocaleString()} → {w.phone}</p>
              <span className="txn-date">{new Date(w.requested_at).toLocaleDateString()}</span>
            </div>
            <span className={`badge ${w.status}`}>{w.status}</span>
          </div>
        ))}
        {withdrawals.length === 0 && <div className="empty">No withdrawals yet.</div>}
      </div>
    </div>
  );
};

// ── PACKAGES PAGE ──────────────────────────────────────────────
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
      toast.success('✅ STK Push sent! Enter your M-Pesa PIN.');
      setTimeout(() => refreshUser && refreshUser(), 8000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    } finally { setBuying(null); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Buy a Package</h1>
      <p className="page-desc">Upgrade to earn more per WhatsApp view.</p>
      <div className="packages-grid">
        {PACKAGES.map(pkg => (
          <div key={pkg.name} className={`package-card ${user?.package_level === pkg.name ? 'active-pkg' : ''}`} style={{ borderColor: pkg.color }}>
            <div className="pkg-name" style={{ color: pkg.color }}>{pkg.name.toUpperCase()}</div>
            <div className="pkg-multiplier">{pkg.multiplier} earnings</div>
            <div className="pkg-price">KES {pkg.price.toLocaleString()}</div>
            <div className="pkg-desc">{pkg.desc}</div>
            {user?.package_level === pkg.name
              ? <span className="current-pkg">✅ Current Package</span>
              : <button className="btn-pkg" style={{ background: pkg.color }} onClick={() => handleBuy(pkg.name)} disabled={buying === pkg.name}>
                  {buying === pkg.name ? 'Sending STK...' : 'Buy Now'}
                </button>
            }
          </div>
        ))}
      </div>
    </div>
  );
};

// ── REFERRALS PAGE ─────────────────────────────────────────────
export const ReferralsPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/user/referrals').then(r => setData(r.data)); }, []);

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success('Referral link copied!'); };

  return (
    <div className="page">
      <WaBanner />
      <h1 className="page-title">Referrals</h1>
      <div className="referral-card">
        <p>Your Referral Code</p>
        <h2 className="ref-code">{user?.referral_code}</h2>
        <input className="ref-link" value={referralLink} readOnly />
        <button className="btn-primary" onClick={copyLink}>📋 Copy Referral Link</button>
      </div>
      <div className="ref-bonuses">
        <h3>Referral Bonuses</h3>
        <div className="bonus-row"><span>Registration</span><strong>KES 50</strong></div>
        <div className="bonus-row"><span>Activation</span><strong>KES 100</strong></div>
        <div className="bonus-row"><span>Package Purchase</span><strong>KES 150</strong></div>
      </div>
      {data && <>
        <div className="stats-grid">
          <div className="stat-card"><div><p className="stat-label">Total Referrals</p><h3>{data.referrals?.length || 0}</h3></div></div>
          <div className="stat-card"><div><p className="stat-label">Total Earned</p><h3>KES {Number(data.total_earned || 0).toLocaleString()}</h3></div></div>
        </div>
        <h2 className="section-title">My Referrals</h2>
        <div className="transactions-list">
          {data.referrals?.map(r => (
            <div key={r.id} className="txn-row">
              <div className="txn-info"><p className="txn-desc">{r.full_name}</p><span className="txn-date">{new Date(r.created_at).toLocaleDateString()}</span></div>
              <span className={`badge ${r.status}`}>{r.package_level?.toUpperCase() || 'NONE'} · {r.status}</span>
            </div>
          ))}
          {data.referrals?.length === 0 && <div className="empty">No referrals yet. Share your link!</div>}
        </div>
      </>}
    </div>
  );
};

// ── PROFILE PAGE ───────────────────────────────────────────────
export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/user/profile', form);
      if (refreshUser) await refreshUser();
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>
      <div className="form-card" style={{ maxWidth: '100%' }}>
        <div className="profile-header">
          <div className="profile-avatar">{user?.full_name?.[0]?.toUpperCase()}</div>
          <div>
            <p><strong>{user?.email}</strong></p>
            <p style={{ color: '#64748b', fontSize: 13 }}>Member since {new Date(user?.created_at || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group"><label>Full Name</label><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input value={user?.email || ''} disabled style={{ opacity: 0.6 }} /></div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>
    </div>
  );
};
