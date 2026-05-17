import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CheckSquare, ArrowUpCircle,
  Receipt, Tv, LogOut, CreditCard, UserPlus, X, Eye, Edit3
} from 'lucide-react';

// ─── MODAL WRAPPER ─────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: 16, overflowY: 'auto'
  }}>
    <div style={{
      background: '#1e293b', borderRadius: 16, padding: 28,
      width: '100%', maxWidth: 560, position: 'relative', maxHeight: '90vh', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ─── FORM HELPERS ──────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="form-group" style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const Inp = (props) => (
  <input {...props} style={{
    width: '100%', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 14,
    boxSizing: 'border-box', ...props.style
  }} />
);

const Sel = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange} style={{
    width: '100%', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 14
  }}>{children}</select>
);

// ─── ADMIN LAYOUT ──────────────────────────────────────────────
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

// ─── ADMIN OVERVIEW ────────────────────────────────────────────
export const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => toast.error('Failed to load stats'));
  }, []);

  if (!stats) return <div className="loading">Loading...</div>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, color: '#6366f1', path: '/admin/users' },
    { label: 'Active Users', value: stats.activeUsers, color: '#22c55e', path: '/admin/users' },
    { label: 'Pending Submissions', value: stats.pendingSubmissions, color: '#f59e0b', path: '/admin/submissions' },
    { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, color: '#ef4444', path: '/admin/withdrawals' },
    { label: 'Total Paid Out', value: `KES ${Number(stats.totalPaid).toLocaleString()}`, color: '#3b82f6', path: '/admin/transactions' },
    { label: 'Total Revenue', value: `KES ${Number(stats.totalRevenue || 0).toLocaleString()}`, color: '#8b5cf6', path: '/admin/payments' },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Admin Overview</h1>
      <div className="stats-grid">
        {cards.map(s => (
          <div key={s.label} className="stat-card" style={{ borderLeft: `3px solid ${s.color}`, cursor: 'pointer' }} onClick={() => navigate(s.path)}>
            <div><p className="stat-label">{s.label}</p><h3 style={{ color: s.color }}>{s.value}</h3></div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ADMIN USERS ───────────────────────────────────────────────
export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', phone: '', email: '', password: '', status: 'active', package_level: 'none', wallet_balance: '0', role: 'user' });
  const [addLoading, setAddLoading] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [userReferrals, setUserReferrals] = useState([]);

  const load = useCallback(() => api.get('/admin/users').then(r => setUsers(r.data.users)), []);
  useEffect(() => { load(); }, [load]);

  const updateUser = async (id, updates) => {
    try {
      await api.patch(`/admin/users/${id}`, updates);
      toast.success('User updated');
      await load();
      if (editUser?.id === id) setEditUser(prev => ({ ...prev, ...updates }));
    } catch { toast.error('Update failed'); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name, phone: u.phone, email: u.email,
      status: u.status, package_level: u.package_level || 'none',
      wallet_balance: u.wallet_balance, role: u.role || 'user',
    });
  };

  const openView = async (u) => {
    setViewUser(u);
    try {
      const r = await api.get(`/admin/users/${u.id}/referrals`);
      setUserReferrals(r.data.referrals || []);
    } catch { setUserReferrals([]); }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/admin/users/${editUser.id}`, editForm);
      toast.success('User saved');
      setEditUser(null);
      load();
    } catch { toast.error('Save failed'); }
  };

  const addUser = async () => {
    if (!addForm.full_name || !addForm.phone || !addForm.email || !addForm.password)
      return toast.error('Fill all required fields');
    setAddLoading(true);
    try {
      await api.post('/admin/users', addForm);
      toast.success('User created');
      setShowAddUser(false);
      setAddForm({ full_name: '', phone: '', email: '', password: '', status: 'active', package_level: 'none', wallet_balance: '0', role: 'user' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally { setAddLoading(false); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted');
      load();
    } catch { toast.error('Failed to delete user'); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search || u.full_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q) || u.email?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Manage Users</h1>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }} onClick={() => setShowAddUser(true)}>
          <UserPlus size={16} /> Add User
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {['all', 'active', 'inactive', 'suspended'].map(s => (
            <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' ? ` (${users.filter(u => u.status === s).length})` : ` (${users.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Status</th><th>Package</th><th>Wallet</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <strong>{u.full_name}</strong>
                  <br /><small style={{ color: '#64748b' }}>{u.email}</small>
                </td>
                <td>{u.phone}</td>
                <td><span className={`badge ${u.status}`}>{u.status}</span></td>
                <td><span className="badge">{u.package_level || 'none'}</span></td>
                <td>KES {Number(u.wallet_balance || 0).toLocaleString()}</td>
                <td><span className="badge" style={{ background: u.role === 'admin' ? '#7c3aed22' : '', color: u.role === 'admin' ? '#a78bfa' : '' }}>{u.role || 'user'}</span></td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  <button className="btn-sm" style={{ background: '#0f172a', border: '1px solid #334155' }} onClick={() => openView(u)} title="View Profile"><Eye size={13} /></button>
                  <button className="btn-sm" style={{ background: '#1d4ed822' }} onClick={() => openEdit(u)} title="Edit User"><Edit3 size={13} /></button>
                  {u.status !== 'active' && <button className="btn-sm green" onClick={() => updateUser(u.id, { status: 'active' })}>Activate</button>}
                  {u.status === 'active' && <button className="btn-sm red" onClick={() => updateUser(u.id, { status: 'suspended' })}>Suspend</button>}
                  {u.status === 'suspended' && <button className="btn-sm" onClick={() => updateUser(u.id, { status: 'active' })}>Restore</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No users found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ADD USER MODAL */}
      {showAddUser && (
        <Modal title="Add User Manually" onClose={() => setShowAddUser(false)}>
          <Field label="Full Name *"><Inp value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="John Doe" /></Field>
          <Field label="Phone Number *"><Inp value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="0712345678" /></Field>
          <Field label="Email *"><Inp type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="john@email.com" /></Field>
          <Field label="Password *"><Inp type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="Min 6 characters" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Status">
              <Sel value={addForm.status} onChange={e => setAddForm({ ...addForm, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Sel>
            </Field>
            <Field label="Package">
              <Sel value={addForm.package_level} onChange={e => setAddForm({ ...addForm, package_level: e.target.value })}>
                <option value="none">None</option>
                <option value="starter">Starter</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </Sel>
            </Field>
            <Field label="Wallet Balance (KES)"><Inp type="number" value={addForm.wallet_balance} onChange={e => setAddForm({ ...addForm, wallet_balance: e.target.value })} /></Field>
            <Field label="Role">
              <Sel value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Sel>
            </Field>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={addUser} disabled={addLoading}>
            {addLoading ? 'Creating...' : '➕ Create User'}
          </button>
        </Modal>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <Modal title={`Edit — ${editUser.full_name}`} onClose={() => setEditUser(null)}>
          <Field label="Full Name"><Inp value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></Field>
          <Field label="Phone"><Inp value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
          <Field label="Email"><Inp value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Status">
              <Sel value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </Sel>
            </Field>
            <Field label="Package">
              <Sel value={editForm.package_level} onChange={e => setEditForm({ ...editForm, package_level: e.target.value })}>
                <option value="none">None</option>
                <option value="starter">Starter</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </Sel>
            </Field>
            <Field label="Wallet Balance (KES)"><Inp type="number" value={editForm.wallet_balance} onChange={e => setEditForm({ ...editForm, wallet_balance: e.target.value })} /></Field>
            <Field label="Role">
              <Sel value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Sel>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={saveEdit}>💾 Save Changes</button>
            <button className="btn-sm red" style={{ flex: 1, padding: '10px 0' }} onClick={() => { deleteUser(editUser.id); setEditUser(null); }}>🗑 Delete User</button>
          </div>
        </Modal>
      )}

      {/* VIEW USER PROFILE MODAL */}
      {viewUser && (
        <Modal title={`Profile — ${viewUser.full_name}`} onClose={() => setViewUser(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Email', value: viewUser.email },
              { label: 'Phone', value: viewUser.phone },
              { label: 'Status', value: viewUser.status },
              { label: 'Package', value: viewUser.package_level || 'None' },
              { label: 'Wallet Balance', value: `KES ${Number(viewUser.wallet_balance || 0).toLocaleString()}` },
              { label: 'Role', value: viewUser.role || 'user' },
              { label: 'Referral Code', value: viewUser.referral_code },
              { label: 'Referred By', value: viewUser.referred_by || '—' },
              { label: 'Joined', value: new Date(viewUser.created_at).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 3px' }}>{label}</p>
                <p style={{ color: '#f1f5f9', margin: 0, fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>{value}</p>
              </div>
            ))}
          </div>
          {userReferrals.length > 0 && (
            <>
              <h3 style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Referrals ({userReferrals.length})</h3>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {userReferrals.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderBottom: '1px solid #1e293b', fontSize: 13 }}>
                    <span>{r.full_name} · {r.phone}</span>
                    <span className={`badge ${r.status}`}>{r.package_level} · {r.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => { openEdit(viewUser); setViewUser(null); }}>✏️ Edit User</button>
            {viewUser.status !== 'active'
              ? <button className="btn-sm green" style={{ flex: 1, padding: '10px 0' }} onClick={() => { updateUser(viewUser.id, { status: 'active' }); setViewUser(null); }}>✅ Activate</button>
              : <button className="btn-sm red" style={{ flex: 1, padding: '10px 0' }} onClick={() => { updateUser(viewUser.id, { status: 'suspended' }); setViewUser(null); }}>🚫 Suspend</button>
            }
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── ADMIN TASKS ───────────────────────────────────────────────
export const AdminTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', image_url: '' });
  const [editTask, setEditTask] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => api.get('/admin/tasks').then(r => setTasks(r.data.tasks)), []);
  useEffect(() => { load(); }, [load]);

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

  const saveEdit = async () => {
    try {
      await api.patch(`/admin/tasks/${editTask.id}`, editTask);
      toast.success('Task updated');
      setEditTask(null);
      load();
    } catch { toast.error('Failed'); }
  };

  const toggleTask = async (id, is_active) => { await api.patch(`/admin/tasks/${id}`, { is_active }); load(); };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task? All submissions for it will also be deleted.')) return;
    try { await api.delete(`/admin/tasks/${id}`); toast.success('Task deleted'); load(); }
    catch { toast.error('Failed to delete task'); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Manage Tasks</h1>
      <div className="form-card">
        <h2 style={{ marginBottom: 16, fontSize: '1rem', color: '#94a3b8' }}>➕ Create New Task</h2>
        <form onSubmit={createTask}>
          <Field label="Title *"><Inp value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Share Kadem launch status" /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what users should post as their WhatsApp status..."
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} /></Field>
          <Field label="Image URL (content image for the status)"><Inp type="url" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></Field>
          {form.image_url && <img src={form.image_url} alt="preview" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} onError={e => e.target.style.display = 'none'} />}
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</button>
        </form>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Image</th><th>Title</th><th>Description</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td>{t.image_url ? <img src={t.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} /> : '—'}</td>
                <td><strong>{t.title}</strong></td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: 13 }}>{t.description}</td>
                <td><span className={`badge ${t.is_active ? 'active' : 'inactive'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  <button className="btn-sm" onClick={() => setEditTask({ ...t })}><Edit3 size={13} /></button>
                  <button className="btn-sm" onClick={() => toggleTask(t.id, !t.is_active)}>{t.is_active ? 'Disable' : 'Enable'}</button>
                  <button className="btn-sm red" onClick={() => deleteTask(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No tasks yet. Create one above.</td></tr>}
          </tbody>
        </table>
      </div>

      {editTask && (
        <Modal title="Edit Task" onClose={() => setEditTask(null)}>
          <Field label="Title"><Inp value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} /></Field>
          <Field label="Description">
            <textarea value={editTask.description || ''} onChange={e => setEditTask({ ...editTask, description: e.target.value })}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} />
          </Field>
          <Field label="Image URL"><Inp value={editTask.image_url || ''} onChange={e => setEditTask({ ...editTask, image_url: e.target.value })} /></Field>
          <Field label="Status">
            <Sel value={editTask.is_active ? 'active' : 'inactive'} onChange={e => setEditTask({ ...editTask, is_active: e.target.value === 'active' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Sel>
          </Field>
          <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={saveEdit}>💾 Save Changes</button>
        </Modal>
      )}
    </div>
  );
};

// ─── ADMIN SUBMISSIONS ─────────────────────────────────────────
export const AdminSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => api.get('/admin/submissions').then(r => setSubmissions(r.data.submissions)), []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status, admin_note = '') => {
    try {
      await api.patch(`/admin/submissions/${id}`, { status, admin_note });
      toast.success(status === 'approved' ? '✅ Approved — wallet credited' : '❌ Rejected');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const filtered = submissions.filter(s => {
    const matchFilter = s.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !search || s.users?.full_name?.toLowerCase().includes(q) || s.users?.phone?.includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <div className="page">
      <h1 className="page-title">Task Submissions</h1>

      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', position: 'relative' }}>
            <img src={preview} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '88vh', borderRadius: 8, display: 'block' }} />
            <button onClick={() => setPreview(null)} style={{
              position: 'absolute', top: -14, right: -14, background: '#ef4444',
              border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16
            }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="search-input" style={{ flex: 1, minWidth: 180 }} placeholder="Search by user name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
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
                <td>
                  <strong>{s.users?.full_name}</strong>
                  <br /><small style={{ color: '#64748b' }}>{s.users?.phone} · <span style={{ color: '#f59e0b' }}>{s.users?.package_level}</span></small>
                </td>
                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tasks?.title}</td>
                <td><strong>{s.views_count?.toLocaleString()}</strong></td>
                <td><strong style={{ color: '#22c55e' }}>KES {Number(s.earning_amount).toLocaleString()}</strong></td>
                <td>
                  {s.screenshot_url ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <img src={s.screenshot_url} alt="thumb" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '2px solid #334155' }} onClick={() => setPreview(s.screenshot_url)} />
                      <button className="btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setPreview(s.screenshot_url)}>Full View</button>
                    </div>
                  ) : <span style={{ color: '#64748b' }}>No photo</span>}
                </td>
                <td>{new Date(s.submitted_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {s.status === 'pending' ? (
                    <>
                      <button className="btn-sm green" onClick={() => review(s.id, 'approved')}>✅ Approve</button>
                      <button className="btn-sm red" onClick={() => {
                        const note = window.prompt('Rejection reason (optional):') || '';
                        review(s.id, 'rejected', note);
                      }}>❌ Reject</button>
                    </>
                  ) : (
                    <span className={`badge ${s.status}`}>{s.status}</span>
                  )}
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

// ─── ADMIN PAYMENTS ────────────────────────────────────────────
export const AdminPayments = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(() => api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)), []);
  useEffect(() => { load(); }, [load]);

  const completePayment = async (txnId, userId, type) => {
    if (!window.confirm('Manually mark as completed?\n\nOnly do this after confirming M-Pesa payment.')) return;
    try {
      await api.patch(`/admin/transactions/${txnId}`, { status: 'completed' });
      if (type === 'activation') await api.patch(`/admin/users/${userId}`, { status: 'active' });
      if (type === 'package') {
        const pkg = transactions.find(t => t.id === txnId)?.description?.match(/^(\w+)\s+package/i)?.[1]?.toLowerCase();
        if (pkg) await api.patch(`/admin/users/${userId}`, { package_level: pkg });
      }
      toast.success('✅ Payment completed & user updated');
      load();
    } catch { toast.error('Failed'); }
  };

  const rejectPayment = async (txnId) => {
    if (!window.confirm('Mark this payment as failed?')) return;
    try {
      await api.patch(`/admin/transactions/${txnId}`, { status: 'failed' });
      toast.success('Payment marked as failed');
      load();
    } catch { toast.error('Failed'); }
  };

  const filtered = transactions.filter(t =>
    (filter === 'all' || t.status === filter) &&
    ['activation', 'package', 'deposit'].includes(t.type)
  );

  return (
    <div className="page">
      <h1 className="page-title">Payment Management</h1>
      <div className="info-banner" style={{ marginBottom: 16 }}>
        ℹ️ Payments auto-process via PayHero callback. Use <strong>Complete</strong> only if you've confirmed the M-Pesa payment but callback failed.
      </div>
      <div className="filter-tabs">
        {['pending', 'completed', 'failed', 'all'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' ? ` (${transactions.filter(t => t.status === f && ['activation', 'package', 'deposit'].includes(t.type)).length})` : ''}
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>M-Pesa Ref</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.users?.full_name}</strong><br /><small style={{ color: '#64748b' }}>{t.users?.phone}</small></td>
                <td><span className="badge">{t.type}</span></td>
                <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.mpesa_code || t.payhero_reference?.slice(0, 20) || '—'}</td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  {t.status === 'pending' && <>
                    <button className="btn-sm green" onClick={() => completePayment(t.id, t.user_id, t.type)}>✅ Complete</button>
                    <button className="btn-sm red" onClick={() => rejectPayment(t.id)}>❌ Fail</button>
                  </>}
                  {t.status !== 'pending' && <span className={`badge ${t.status}`}>{t.status}</span>}
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

// ─── ADMIN WITHDRAWALS ─────────────────────────────────────────
export const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);

  const load = useCallback(() => api.get('/admin/withdrawals').then(r => setWithdrawals(r.data.withdrawals)), []);
  useEffect(() => { load(); }, [load]);

  const process = async (id, action) => {
    setProcessing(id);
    try {
      const admin_note = action === 'reject' ? (window.prompt('Rejection reason (optional):') || '') : '';
      await api.patch(`/admin/withdrawals/${id}`, { action, admin_note });
      toast.success(action === 'approve'
        ? '✅ Withdrawal approved — M-Pesa payout sent!'
        : '❌ Withdrawal rejected — amount refunded to wallet');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process withdrawal');
    } finally { setProcessing(null); }
  };

  const filtered = withdrawals.filter(w => w.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Withdrawal Requests</h1>
      <div className="filter-tabs">
        {['pending', 'paid', 'rejected'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({withdrawals.filter(w => w.status === f).length})
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Package</th><th>Wallet</th><th>Amount</th><th>M-Pesa Phone</th><th>Requested</th><th>Note</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id}>
                <td><strong>{w.users?.full_name}</strong><br /><small style={{ color: '#64748b' }}>{w.users?.phone}</small></td>
                <td><span className="badge">{w.users?.package_level}</span></td>
                <td style={{ color: '#94a3b8' }}>KES {Number(w.users?.wallet_balance || 0).toLocaleString()}</td>
                <td><strong style={{ color: '#22c55e' }}>KES {Number(w.amount).toLocaleString()}</strong></td>
                <td style={{ fontFamily: 'monospace' }}>{w.phone}</td>
                <td>{new Date(w.requested_at).toLocaleDateString()}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{w.admin_note || '—'}</td>
                <td className="action-btns">
                  {w.status === 'pending' ? (
                    <>
                      <button className="btn-sm green" onClick={() => process(w.id, 'approve')} disabled={processing === w.id}>
                        {processing === w.id ? '⏳...' : '✅ Pay'}
                      </button>
                      <button className="btn-sm red" onClick={() => process(w.id, 'reject')} disabled={processing === w.id}>
                        ❌ Reject
                      </button>
                    </>
                  ) : (
                    <span className={`badge ${w.status}`}>{w.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No {filter} withdrawals</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ADMIN TRANSACTIONS ────────────────────────────────────────
export const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)); }, []);

  const typeColors = { earning: '#22c55e', referral: '#6366f1', withdrawal: '#ef4444', deposit: '#3b82f6', activation: '#f59e0b', package: '#8b5cf6' };

  const filtered = transactions.filter(t => {
    const matchType = filter === 'all' || t.type === filter;
    const q = search.toLowerCase();
    const matchSearch = !search || t.users?.full_name?.toLowerCase().includes(q) || t.users?.phone?.includes(q);
    return matchType && matchSearch;
  });

  const total = filtered.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="page">
      <h1 className="page-title">All Transactions</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="search-input" style={{ flex: 1, minWidth: 180 }} placeholder="Search by user name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {['all', 'activation', 'package', 'deposit', 'earning', 'referral', 'withdrawal'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
        Showing {filtered.length} transactions · Total: <strong style={{ color: '#f1f5f9' }}>KES {total.toLocaleString()}</strong>
      </p>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>M-Pesa Code</th><th>Description</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.users?.full_name}</strong><br /><small style={{ color: '#64748b' }}>{t.users?.phone}</small></td>
                <td><span className="badge" style={{ background: (typeColors[t.type] || '#64748b') + '22', color: typeColors[t.type] || '#94a3b8' }}>{t.type}</span></td>
                <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.mpesa_code || '—'}</td>
                <td style={{ maxWidth: 180, fontSize: 12, color: '#94a3b8' }}>{t.description || '—'}</td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No transactions found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
