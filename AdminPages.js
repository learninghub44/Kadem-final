import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, CheckSquare, ArrowUpCircle, Receipt, Tv, LogOut } from 'lucide-react';

// ======================== ADMIN LAYOUT ========================
export const AdminLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const adminNav = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/tasks', icon: Tv, label: 'Tasks' },
    { to: '/admin/submissions', icon: CheckSquare, label: 'Submissions' },
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
            <LayoutDashboard size={18} /><span>User Dashboard</span>
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
          { label: 'Total Users', value: stats.totalUsers },
          { label: 'Active Users', value: stats.activeUsers },
          { label: 'Pending Submissions', value: stats.pendingSubmissions },
          { label: 'Pending Withdrawals', value: stats.pendingWithdrawals },
          { label: 'Total Paid Out', value: `KES ${Number(stats.totalPaid).toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="stat-card"><div><p className="stat-label">{s.label}</p><h3>{s.value}</h3></div></div>
        ))}
      </div>
    </div>
  );
};

// ======================== ADMIN USERS ========================
export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/admin/users').then(r => setUsers(r.data.users)); }, []);

  const updateUser = async (id, updates) => {
    try {
      await api.patch(`/admin/users/${id}`, updates);
      toast.success('User updated');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    } catch { toast.error('Update failed'); }
  };

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <h1 className="page-title">Manage Users</h1>
      <input className="search-input" placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Package</th><th>Wallet</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>{u.full_name}<br/><small>{u.email}</small></td>
                <td>{u.phone}</td>
                <td><span className={`badge ${u.status}`}>{u.status}</span></td>
                <td>{u.package_level}</td>
                <td>KES {Number(u.wallet_balance).toLocaleString()}</td>
                <td className="action-btns">
                  {u.status !== 'active' && <button className="btn-sm green" onClick={() => updateUser(u.id, { status: 'active' })}>Activate</button>}
                  {u.status !== 'suspended' && <button className="btn-sm red" onClick={() => updateUser(u.id, { status: 'suspended' })}>Suspend</button>}
                  {u.status === 'suspended' && <button className="btn-sm" onClick={() => updateUser(u.id, { status: 'active' })}>Restore</button>}
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
          <div className="form-group"><label>Image URL</label><input type="url" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} /></div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</button>
        </form>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td>{t.title}</td>
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

// ======================== ADMIN SUBMISSIONS ========================
export const AdminSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = () => api.get('/admin/submissions').then(r => setSubmissions(r.data.submissions));
  useEffect(() => { load(); }, []);

  const review = async (id, status) => {
    try {
      await api.patch(`/admin/submissions/${id}`, { status });
      toast.success(`Submission ${status}`);
      load();
    } catch { toast.error('Failed to update submission'); }
  };

  const filtered = submissions.filter(s => s.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Task Submissions</h1>
      <div className="filter-tabs">
        {['pending', 'approved', 'rejected'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({submissions.filter(s => s.status === f).length})
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Task</th><th>Views</th><th>Earning</th><th>Screenshot</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>{s.users?.full_name}<br/><small>{s.users?.package_level}</small></td>
                <td>{s.tasks?.title}</td>
                <td>{s.views_count}</td>
                <td>KES {Number(s.earning_amount).toLocaleString()}</td>
                <td><a href={s.screenshot_url} target="_blank" rel="noreferrer" className="link">View Screenshot</a></td>
                <td className="action-btns">
                  {s.status === 'pending' && (
                    <>
                      <button className="btn-sm green" onClick={() => review(s.id, 'approved')}>Approve</button>
                      <button className="btn-sm red" onClick={() => review(s.id, 'rejected')}>Reject</button>
                    </>
                  )}
                  {s.status !== 'pending' && <span className={`badge ${s.status}`}>{s.status}</span>}
                </td>
              </tr>
            ))}
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

  const load = () => api.get('/admin/withdrawals').then(r => setWithdrawals(r.data.withdrawals));
  useEffect(() => { load(); }, []);

  const process = async (id, action) => {
    try {
      await api.patch(`/admin/withdrawals/${id}`, { action });
      toast.success(`Withdrawal ${action}d`);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
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
          <thead><tr><th>User</th><th>Amount</th><th>Phone</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id}>
                <td>{w.users?.full_name}<br/><small>{w.users?.package_level}</small></td>
                <td><strong>KES {Number(w.amount).toLocaleString()}</strong></td>
                <td>{w.phone}</td>
                <td>{new Date(w.requested_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {w.status === 'pending' && (
                    <>
                      <button className="btn-sm green" onClick={() => process(w.id, 'approve')}>Approve & Pay</button>
                      <button className="btn-sm red" onClick={() => process(w.id, 'reject')}>Reject</button>
                    </>
                  )}
                  {w.status !== 'pending' && <span className={`badge ${w.status}`}>{w.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======================== ADMIN TRANSACTIONS ========================
export const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => { api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)); }, []);

  return (
    <div className="page">
      <h1 className="page-title">All Transactions</h1>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>M-Pesa Code</th><th>Date</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td>{t.users?.full_name}</td>
                <td><span className="badge">{t.type}</span></td>
                <td>KES {Number(t.amount).toLocaleString()}</td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td>{t.mpesa_code || '—'}</td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
