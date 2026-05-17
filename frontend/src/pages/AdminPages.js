import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, CheckSquare, ArrowUpCircle, Receipt, Tv, LogOut, CreditCard } from 'lucide-react';

// ======================== ADMIN LAYOUT ========================
export const AdminLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const adminNav = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/tasks', icon: Tv, label: 'Tasks' },
    { to: '/admin/submissions', icon: CheckSquare, label: 'Submissions' },
    { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
    { to: '/admin/withdrawals', icon: ArrowUpCircle, label: 'Withdrawals' },
    { to: '/admin/transactions', icon: Receipt, label: 'Transactions' },
  ];

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><span className="logo-text">Kadem</span><span className="logo-sub">Admin</span></div>
        </div>
        <nav className="sidebar-nav">
          {adminNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/dashboard" className="nav-item">
            <LayoutDashboard size={18} /><span>User View</span>
          </NavLink>
        </nav>
        <button className="nav-item logout-btn" onClick={() => { logout(); navigate('/login'); }}>
          <LogOut size={18} /><span>Logout</span>
        </button>
      </aside>
      <main className="main-content"><div className="page-content"><Outlet /></div></main>
    </div>
  );
};

// ======================== ADMIN OVERVIEW ========================
export const AdminOverview = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => toast.error('Failed to load stats'));
  }, []);

  if (!stats) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Admin Overview</h1>
      <div className="stats-grid">
        {[
          { label: 'Total Users', value: stats.totalUsers, color: '#6366f1' },
          { label: 'Active Users', value: stats.activeUsers, color: '#22c55e' },
          { label: 'Pending Submissions', value: stats.pendingSubmissions, color: '#f59e0b' },
          { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, color: '#ef4444' },
          { label: 'Total Paid Out', value: `KES ${Number(stats.totalPaid).toLocaleString()}`, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div><p className="stat-label">{s.label}</p><h3 style={{ color: s.color }}>{s.value}</h3></div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ======================== ADMIN USERS ========================
export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { api.get('/admin/users').then(r => setUsers(r.data.users)); }, []);

  const updateUser = async (id, updates) => {
    try {
      await api.patch(`/admin/users/${id}`, updates);
      toast.success('User updated');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    } catch { toast.error('Update failed'); }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page">
      <h1 className="page-title">Manage Users</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {['all','active','inactive','suspended'].map(s => (
            <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)} {s !== 'all' ? `(${users.filter(u => u.status === s).length})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Package</th><th>Wallet</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>{u.full_name}<br/><small style={{ color: '#64748b' }}>{u.email}</small></td>
                <td>{u.phone}</td>
                <td><span className={`badge ${u.status}`}>{u.status}</span></td>
                <td>{u.package_level || '—'}</td>
                <td>KES {Number(u.wallet_balance || 0).toLocaleString()}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {u.status !== 'active' && <button className="btn-sm green" onClick={() => updateUser(u.id, { status: 'active' })}>Activate</button>}
                  {u.status === 'active' && <button className="btn-sm red" onClick={() => updateUser(u.id, { status: 'suspended' })}>Suspend</button>}
                  {u.status === 'suspended' && <button className="btn-sm" onClick={() => updateUser(u.id, { status: 'active' })}>Restore</button>}
                  {u.role !== 'admin' && <button className="btn-sm" style={{ background: '#7c3aed' }} onClick={() => updateUser(u.id, { role: 'admin' })}>Make Admin</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN TASKS ========================
export const AdminTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', image_url: '' });
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/admin/tasks').then(r => setTasks(r.data.tasks));
  useEffect(() => { load(); }, []);

  const createTask = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/tasks', form);
      toast.success('Task created');
      setForm({ title: '', description: '', image_url: '' });
      load();
    } catch { toast.error('Failed to create task'); } finally { setLoading(false); }
  };

  const toggleTask = async (id, is_active) => {
    await api.patch(`/admin/tasks/${id}`, { is_active });
    load();
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await api.delete(`/admin/tasks/${id}`);
    toast.success('Task deleted');
    load();
  };

  return (
    <div className="page">
      <h1 className="page-title">Manage Tasks</h1>
      <div className="form-card">
        <h2>Create New Task</h2>
        <form onSubmit={createTask}>
          <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
          <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div className="form-group"><label>Image URL (the WhatsApp status image)</label><input type="url" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} /></div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</button>
        </form>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Description</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td><strong>{t.title}</strong></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                <td><span className={`badge ${t.is_active ? 'active' : 'inactive'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  <button className="btn-sm" onClick={() => toggleTask(t.id, !t.is_active)}>{t.is_active ? 'Disable' : 'Enable'}</button>
                  <button className="btn-sm red" onClick={() => deleteTask(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN SUBMISSIONS (with photo preview) ========================
export const AdminSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [preview, setPreview] = useState(null);

  const load = () => api.get('/admin/submissions').then(r => setSubmissions(r.data.submissions));
  useEffect(() => { load(); }, []);

  const review = async (id, status, admin_note = '') => {
    try {
      await api.patch(`/admin/submissions/${id}`, { status, admin_note });
      toast.success(`✅ Submission ${status}`);
      load();
    } catch { toast.error('Failed to update submission'); }
  };

  const filtered = submissions.filter(s => s.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Task Submissions</h1>

      {/* Photo Preview Modal */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <img src={preview} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }} />
            <button onClick={() => setPreview(null)} style={{
              position: 'absolute', top: -12, right: -12, background: '#ef4444',
              border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16
            }}>✕</button>
          </div>
        </div>
      )}

      <div className="filter-tabs">
        {['pending', 'approved', 'rejected'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({submissions.filter(s => s.status === f).length})
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Task</th><th>Views</th><th>Earning</th><th>Screenshot</th><th>Submitted</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>{s.users?.full_name}<br/><small style={{ color: '#64748b' }}>{s.users?.package_level}</small></td>
                <td>{s.tasks?.title}</td>
                <td><strong>{s.views_count}</strong></td>
                <td><strong style={{ color: '#22c55e' }}>KES {Number(s.earning_amount).toLocaleString()}</strong></td>
                <td>
                  {s.screenshot_url ? (
                    <button
                      className="btn-sm"
                      style={{ background: '#0f172a', border: '1px solid #334155' }}
                      onClick={() => setPreview(s.screenshot_url)}
                    >
                      📷 View Photo
                    </button>
                  ) : '—'}
                </td>
                <td>{new Date(s.submitted_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {s.status === 'pending' && (
                    <>
                      <button className="btn-sm green" onClick={() => review(s.id, 'approved')}>✅ Approve</button>
                      <button className="btn-sm red" onClick={() => {
                        const note = window.prompt('Rejection reason (optional):');
                        review(s.id, 'rejected', note || '');
                      }}>❌ Reject</button>
                    </>
                  )}
                  {s.status !== 'pending' && <span className={`badge ${s.status}`}>{s.status}</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No {filter} submissions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN PAYMENTS (manual approve/reject) ========================
export const AdminPayments = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = () => api.get('/admin/transactions').then(r => setTransactions(r.data.transactions));
  useEffect(() => { load(); }, []);

  const rejectPayment = async (txnId) => {
    if (!window.confirm('Mark this payment as failed?')) return;
    try {
      await api.patch(`/admin/transactions/${txnId}`, { status: 'failed' });
      toast.success('Payment marked as failed');
      load();
    } catch { toast.error('Failed to update payment'); }
  };

  const completePayment = async (txnId, userId, type) => {
    if (!window.confirm('Manually mark as completed? Only do this if you confirmed M-Pesa payment.')) return;
    try {
      await api.patch(`/admin/transactions/${txnId}`, { status: 'completed' });
      if (type === 'activation') {
        await api.patch(`/admin/users/${userId}`, { status: 'active' });
      }
      toast.success('Payment completed & user updated');
      load();
    } catch { toast.error('Failed'); }
  };

  const filtered = transactions.filter(t =>
    (filter === 'all' || t.status === filter) &&
    ['activation','package','deposit'].includes(t.type)
  );

  return (
    <div className="page">
      <h1 className="page-title">Payment Management</h1>
      <div className="info-banner" style={{ marginBottom: 16 }}>
        ℹ️ Payments are processed automatically via PayHero callback. Use <strong>Manual Activate</strong> only if PayHero callback failed but you've confirmed M-Pesa payment.
      </div>
      <div className="filter-tabs">
        {['pending', 'completed', 'failed', 'all'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' ? `(${transactions.filter(t => t.status === f && ['activation','package','deposit'].includes(t.type)).length})` : ''}
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>M-Pesa Ref</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td>{t.users?.full_name}<br/><small style={{ color: '#64748b' }}>{t.users?.phone}</small></td>
                <td><span className="badge">{t.type}</span></td>
                <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.mpesa_code || t.payhero_reference?.slice(0, 20) || '—'}</td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {t.status === 'pending' && (
                    <button className="btn-sm green" onClick={() => completePayment(t.id, t.user_id, t.type)}>
                      ✅ Complete
                    </button>
                  )}
                  {t.status === 'pending' && (
                    <button className="btn-sm red" onClick={() => rejectPayment(t.id)}>
                      ❌ Mark Failed
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No {filter} payments</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN WITHDRAWALS ========================
export const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  const load = () => api.get('/admin/withdrawals').then(r => setWithdrawals(r.data.withdrawals));
  useEffect(() => { load(); }, []);

  const process = async (id, action) => {
    setProcessing(id);
    try {
      const admin_note = action === 'reject' ? (window.prompt('Rejection reason:') || '') : '';
      await api.patch(`/admin/withdrawals/${id}`, { action, admin_note });
      toast.success(action === 'approve' ? '✅ Withdrawal approved & M-Pesa payout sent!' : '❌ Withdrawal rejected. Amount refunded to user.');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setProcessing(null); }
  };

  const filtered = withdrawals.filter(w => w.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Withdrawals</h1>
      <div className="filter-tabs">
        {['pending', 'paid', 'rejected'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({withdrawals.filter(w => w.status === f).length})
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Package</th><th>Amount</th><th>Phone</th><th>Requested</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id}>
                <td><strong>{w.users?.full_name}</strong></td>
                <td><span className="badge">{w.users?.package_level}</span></td>
                <td><strong style={{ color: '#22c55e' }}>KES {Number(w.amount).toLocaleString()}</strong></td>
                <td>{w.phone}</td>
                <td>{new Date(w.requested_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {w.status === 'pending' && (
                    <>
                      <button className="btn-sm green" onClick={() => process(w.id, 'approve')} disabled={processing === w.id}>
                        {processing === w.id ? '⏳ Processing...' : '✅ Approve & Pay'}
                      </button>
                      <button className="btn-sm red" onClick={() => process(w.id, 'reject')} disabled={processing === w.id}>
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {w.status !== 'pending' && (
                    <span className={`badge ${w.status}`}>{w.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No {filter} withdrawals</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN TRANSACTIONS ========================
export const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)); }, []);

  const typeColors = { earning: '#22c55e', referral: '#6366f1', withdrawal: '#ef4444', deposit: '#3b82f6', activation: '#f59e0b', package: '#8b5cf6' };

  const filtered = transactions.filter(t => {
    const matchType = filter === 'all' || t.type === filter;
    const matchSearch = !search || t.users?.full_name?.toLowerCase().includes(search.toLowerCase()) || t.users?.phone?.includes(search);
    return matchType && matchSearch;
  });

  return (
    <div className="page">
      <h1 className="page-title">All Transactions</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 180 }} placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {['all', 'activation', 'package', 'deposit', 'earning', 'referral', 'withdrawal'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>M-Pesa Code</th><th>Description</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td>{t.users?.full_name}<br/><small style={{ color: '#64748b' }}>{t.users?.phone}</small></td>
                <td><span className="badge" style={{ background: typeColors[t.type] + '22', color: typeColors[t.type] }}>{t.type}</span></td>
                <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.mpesa_code || '—'}</td>
                <td style={{ maxWidth: 180, fontSize: 12 }}>{t.description || '—'}</td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
