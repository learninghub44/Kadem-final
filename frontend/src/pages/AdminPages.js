import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CheckSquare, ArrowUpCircle,
  Receipt, Tv, LogOut, CreditCard, Menu, X, RefreshCw
} from 'lucide-react';

// ─── SIDEBAR NAV ────────────────────────────────────────────────────────────
const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/tasks', icon: Tv, label: 'Tasks' },
  { to: '/admin/submissions', icon: CheckSquare, label: 'Submissions' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/withdrawals', icon: ArrowUpCircle, label: 'Withdrawals' },
  { to: '/admin/transactions', icon: Receipt, label: 'All Transactions' },
];

// ─── ADMIN LAYOUT ────────────────────────────────────────────────────────────
export const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-text">Drivenwave</span>
            <span className="logo-sub" style={{ color: '#f59e0b' }}>Admin Panel</span>
          </div>
          <button className="close-btn" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>

        <div className="user-info">
          <div className="avatar" style={{ background: '#f59e0b', color: '#000' }}>
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="user-name">{user?.full_name}</p>
            <span className="status-badge" style={{ background: '#f59e0b', color: '#000' }}>ADMIN</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {adminNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/dashboard" className="nav-item" style={{ color: '#60a5fa' }} onClick={() => setOpen(false)}>
            <LayoutDashboard size={18} /><span>User Dashboard</span>
          </NavLink>
        </nav>

        <button className="nav-item logout-btn" onClick={() => { logout(); navigate('/login'); }}>
          <LogOut size={18} /><span>Logout</span>
        </button>
      </aside>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span style={{ fontFamily: 'Sora', fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem' }}>
            ADMIN
          </span>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
};

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
export const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/dashboard')
      .then(r => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading">Loading overview...</div>;

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, color: '#6366f1' },
    { label: 'Active Users', value: stats?.activeUsers || 0, color: '#22c55e' },
    { label: 'Pending Submissions', value: stats?.pendingSubmissions || 0, color: '#f59e0b' },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals || 0, color: '#ef4444' },
    { label: 'Total Paid Out', value: `KES ${Number(stats?.totalPaid || 0).toLocaleString()}`, color: '#3b82f6' },
    { label: 'Total Revenue', value: `KES ${Number(stats?.totalRevenue || 0).toLocaleString()}`, color: '#8b5cf6' },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Overview</h1>
        <button className="btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card" style={{ borderLeft: `3px solid ${c.color}` }}>
            <div>
              <p className="stat-label">{c.label}</p>
              <h3 style={{ color: c.color, fontFamily: 'Sora', fontWeight: 700 }}>{c.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>Quick Links</h2>
        <div className="actions-grid">
          {[
            { label: 'Review Submissions', to: '/admin/submissions' },
            { label: 'Process Withdrawals', to: '/admin/withdrawals' },
            { label: 'Post New Task', to: '/admin/tasks' },
            { label: 'Manage Users', to: '/admin/users' },
            { label: 'Check Payments', to: '/admin/payments' },
            { label: 'All Transactions', to: '/admin/transactions' },
          ].map(l => (
            <NavLink key={l.to} to={l.to} className="action-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── USERS ───────────────────────────────────────────────────────────────────
export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/users').then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, updates, label) => {
    try {
      await api.patch(`/admin/users/${id}`, updates);
      toast.success(label || 'User updated');
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (selectedUser?.id === id) setSelectedUser(prev => ({ ...prev, ...updates }));
    } catch { toast.error('Update failed'); }
  };

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !search || u.full_name?.toLowerCase().includes(s) ||
      u.phone?.includes(search) || u.email?.toLowerCase().includes(s) ||
      u.referral_code?.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusCounts = { active: 0, inactive: 0, suspended: 0 };
  users.forEach(u => { if (statusCounts[u.status] !== undefined) statusCounts[u.status]++; });

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Users ({users.length})</h1>
        <button className="btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="search-input" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}
          placeholder="Search name, phone, email, referral code..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {[
            { key: 'all', label: `All (${users.length})` },
            { key: 'active', label: `Active (${statusCounts.active})` },
            { key: 'inactive', label: `Inactive (${statusCounts.inactive})` },
            { key: 'suspended', label: `Suspended (${statusCounts.suspended})` },
          ].map(f => (
            <button key={f.key} className={`filter-tab ${filterStatus === f.key ? 'active' : ''}`} onClick={() => setFilterStatus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div onClick={() => setSelectedUser(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1e2535', border: '1px solid #2a3347', borderRadius: 16,
            padding: 28, maxWidth: 480, width: '100%', position: 'relative'
          }}>
            <button onClick={() => setSelectedUser(null)} style={{
              position: 'absolute', top: 16, right: 16, background: 'none',
              border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20
            }}>X</button>
            <h2 style={{ marginBottom: 20 }}>{selectedUser.full_name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, fontSize: '0.9rem' }}>
              {[
                ['Email', selectedUser.email],
                ['Phone', selectedUser.phone],
                ['Status', selectedUser.status],
                ['Role', selectedUser.role],
                ['Package', selectedUser.package_level || 'none'],
                ['Wallet', `KES ${Number(selectedUser.wallet_balance || 0).toLocaleString()}`],
                ['Referral Code', selectedUser.referral_code],
                ['Referred By', selectedUser.referred_by || '—'],
                ['Joined', new Date(selectedUser.created_at).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2a3347', paddingBottom: 8 }}>
                  <span style={{ color: '#94a3b8' }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedUser.status !== 'active' && (
                <button className="btn-sm green" onClick={() => update(selectedUser.id, { status: 'active' }, 'User activated')}>Activate</button>
              )}
              {selectedUser.status === 'active' && (
                <button className="btn-sm red" onClick={() => update(selectedUser.id, { status: 'suspended' }, 'User suspended')}>Suspend</button>
              )}
              {selectedUser.status === 'suspended' && (
                <button className="btn-sm" onClick={() => update(selectedUser.id, { status: 'inactive' }, 'User restored')}>Restore</button>
              )}
              {selectedUser.role !== 'admin' && (
                <button className="btn-sm" style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                  onClick={() => { if (window.confirm('Make this user an admin?')) update(selectedUser.id, { role: 'admin' }, 'User is now admin'); }}>
                  Make Admin
                </button>
              )}
              {selectedUser.role === 'admin' && (
                <button className="btn-sm" onClick={() => { if (window.confirm('Remove admin role?')) update(selectedUser.id, { role: 'user' }, 'Admin role removed'); }}>
                  Remove Admin
                </button>
              )}
              {['starter','bronze','silver','gold'].map(pkg => (
                <button key={pkg} className="btn-sm" style={{ fontSize: '0.72rem' }}
                  onClick={() => update(selectedUser.id, { package_level: pkg }, `Package set to ${pkg}`)}>
                  Set {pkg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="loading">Loading users...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Package</th>
                <th>Wallet</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <span style={{ fontWeight: 600, cursor: 'pointer', color: '#4f8ef7' }} onClick={() => setSelectedUser(u)}>
                      {u.full_name}
                    </span>
                    {u.role === 'admin' && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>ADMIN</span>}
                    <br />
                    <small style={{ color: '#64748b' }}>{u.email}</small>
                  </td>
                  <td>{u.phone}</td>
                  <td><span className={`badge ${u.status}`}>{u.status}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{u.package_level || '—'}</td>
                  <td style={{ fontWeight: 600 }}>KES {Number(u.wallet_balance || 0).toLocaleString()}</td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="action-btns">
                    <button className="btn-sm" onClick={() => setSelectedUser(u)}>View</button>
                    {u.status !== 'active' && <button className="btn-sm green" onClick={() => update(u.id, { status: 'active' }, 'Activated')}>Activate</button>}
                    {u.status === 'active' && <button className="btn-sm red" onClick={() => update(u.id, { status: 'suspended' }, 'Suspended')}>Suspend</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const AdminTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', image_url: '' });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const load = () => api.get('/admin/tasks').then(r => setTasks(r.data.tasks));
  useEffect(() => { load(); }, []);

  const uploadImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please drop an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const image_base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/tasks/upload-image', { image_base64, image_mime: file.type });
      setForm(f => ({ ...f, image_url: res.data.image_url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    uploadImage(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await api.patch(`/admin/tasks/${editing}`, form);
        toast.success('Task updated');
        setEditing(null);
      } else {
        await api.post('/admin/tasks', form);
        toast.success('Task created');
      }
      setForm({ title: '', description: '', image_url: '' });
      load();
    } catch { toast.error('Failed to save task'); } finally { setLoading(false); }
  };

  const startEdit = (task) => {
    setEditing(task.id);
    setForm({ title: task.title, description: task.description || '', image_url: task.image_url || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTask = async (id, is_active) => {
    await api.patch(`/admin/tasks/${id}`, { is_active });
    toast.success(is_active ? 'Task enabled' : 'Task disabled');
    load();
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    await api.delete(`/admin/tasks/${id}`);
    toast.success('Task deleted');
    load();
  };

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <h1 className="page-title">{editing ? 'Edit Task' : 'Tasks'}</h1>

      <div className="form-card" style={{ maxWidth: 600 }}>
        <h2 style={{ marginBottom: 20 }}>{editing ? 'Edit Task' : 'Create New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Task Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Post Drivenwave Promo #1" required />
          </div>
          <div className="form-group">
            <label>Instructions / Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Tell users what to do with this image..." />
          </div>
          <div className="form-group">
            <label>Task Image (WhatsApp Status Image)</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
              onDrop={handleDrop}
              onClick={() => document.getElementById('task-image-input').click()}
              style={{
                border: `2px dashed ${dragActive ? '#4f8ef7' : '#2a3347'}`,
                borderRadius: 10, padding: form.image_url ? 12 : 28,
                textAlign: 'center', cursor: 'pointer',
                background: dragActive ? 'rgba(79,142,247,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <input
                id="task-image-input" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => uploadImage(e.target.files?.[0])}
              />
              {uploading ? (
                <p style={{ color: '#94a3b8', margin: 0 }}>Uploading...</p>
              ) : form.image_url ? (
                <>
                  <img src={form.image_url} alt="Preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Drag a new image here or click to replace
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
                  Drag & drop an image here, or click to browse
                </p>
              )}
            </div>
            {form.image_url && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: '' })); }}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
              >
                Remove image
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Saving...' : editing ? 'Update Task' : 'Post Task'}
            </button>
            {editing && (
              <button type="button" className="btn-primary" style={{ flex: 1, background: '#334155' }}
                onClick={() => { setEditing(null); setForm({ title: '', description: '', image_url: '' }); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>All Tasks ({tasks.length})</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Image</th><th>Title</th><th>Description</th><th>Status</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td>
                  {t.image_url
                    ? <img src={t.image_url} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    : <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No image</span>
                  }
                </td>
                <td><strong>{t.title}</strong></td>
                <td style={{ maxWidth: 220, fontSize: '0.82rem', color: '#94a3b8' }}>
                  {t.description?.slice(0, 80) || '—'}{t.description?.length > 80 ? '...' : ''}
                </td>
                <td>
                  <span className={`badge ${t.is_active ? 'active' : 'inactive'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="action-btns">
                  <button className="btn-sm" onClick={() => startEdit(t)}>Edit</button>
                  <button className="btn-sm" style={{ color: t.is_active ? '#ef4444' : '#22c55e', borderColor: t.is_active ? '#ef4444' : '#22c55e' }}
                    onClick={() => toggleTask(t.id, !t.is_active)}>
                    {t.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn-sm red" onClick={() => deleteTask(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No tasks yet. Create one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────
export const AdminSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/submissions').then(r => setSubmissions(r.data.submissions)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    let admin_note = '';
    if (status === 'rejected') {
      admin_note = window.prompt('Reason for rejection (shown to user):') || '';
    }
    try {
      await api.patch(`/admin/submissions/${id}`, { status, admin_note });
      toast.success(status === 'approved' ? 'Approved! Earnings credited to user.' : 'Submission rejected.');
      load();
    } catch { toast.error('Failed to update submission'); }
  };

  const counts = { pending: 0, approved: 0, rejected: 0 };
  submissions.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
  const filtered = submissions.filter(s => s.status === filter);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Submissions</h1>
        <button className="btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* Screenshot Preview Modal */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw' }}>
            <img src={preview} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '88vh', borderRadius: 10, display: 'block' }} />
            <button onClick={() => setPreview(null)} style={{
              position: 'absolute', top: -14, right: -14, background: '#ef4444',
              border: 'none', color: '#fff', borderRadius: '50%', width: 34, height: 34,
              cursor: 'pointer', fontSize: 18, fontWeight: 700
            }}>X</button>
          </div>
        </div>
      )}

      <div className="filter-tabs">
        {[
          { key: 'pending', label: `Pending (${counts.pending})` },
          { key: 'approved', label: `Approved (${counts.approved})` },
          { key: 'rejected', label: `Rejected (${counts.rejected})` },
        ].map(f => (
          <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading submissions...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th><th>Package</th><th>Task</th><th>Views</th>
                <th>Earning</th><th>Screenshot</th><th>Submitted</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.users?.full_name}</strong><br />
                    <small style={{ color: '#64748b' }}>{s.users?.phone}</small>
                  </td>
                  <td>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>
                      {s.users?.package_level || 'none'}
                    </span>
                  </td>
                  <td style={{ maxWidth: 140, fontSize: '0.82rem' }}>{s.tasks?.title}</td>
                  <td><strong style={{ fontSize: '1.05rem' }}>{s.views_count?.toLocaleString()}</strong></td>
                  <td><strong style={{ color: '#22c55e' }}>KES {Number(s.earning_amount).toLocaleString()}</strong></td>
                  <td>
                    {s.screenshot_url ? (
                      <button className="btn-sm" style={{ background: '#0f172a', borderColor: '#4f8ef7', color: '#4f8ef7' }}
                        onClick={() => setPreview(s.screenshot_url)}>
                        View
                      </button>
                    ) : <span style={{ color: '#64748b', fontSize: '0.8rem' }}>None</span>}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                  <td className="action-btns">
                    {s.status === 'pending' ? (
                      <>
                        <button className="btn-sm green" onClick={() => review(s.id, 'approved')}>Approve</button>
                        <button className="btn-sm red" onClick={() => review(s.id, 'rejected')}>Reject</button>
                      </>
                    ) : (
                      <span className={`badge ${s.status}`}>{s.status}</span>
                    )}
                    {s.admin_note && <span title={s.admin_note} style={{ cursor: 'help', fontSize: '0.8rem' }}>Note</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No {filter} submissions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
export const AdminPayments = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const manualComplete = async (txn) => {
    if (!window.confirm(`Manually mark this payment as complete?\nUser: ${txn.users?.full_name}\nAmount: KES ${txn.amount}\n\nOnly do this if you have confirmed M-Pesa payment.`)) return;
    try {
      if (txn.type === 'activation') {
        await api.patch(`/admin/users/${txn.user_id}`, { status: 'active' });
      }
      if (txn.type === 'package') {
        const parts = txn.paystack_reference?.split('-');
        const pkg = parts?.[1]?.toLowerCase();
        if (pkg && ['starter','bronze','silver','gold'].includes(pkg)) {
          await api.patch(`/admin/users/${txn.user_id}`, { package_level: pkg });
        }
      }
      toast.success('Payment manually completed. User updated.');
      load();
    } catch { toast.error('Failed'); }
  };

  const markFailed = async (id) => {
    if (!window.confirm('Mark this payment as failed?')) return;
    try {
      await api.patch(`/admin/transactions/${id}`, { status: 'failed' });
      toast.success('Payment marked as failed');
      load();
    } catch { toast.error('Failed'); }
  };

  const paymentTxns = transactions.filter(t => ['activation', 'package', 'deposit'].includes(t.type));
  const counts = { pending: 0, completed: 0, failed: 0 };
  paymentTxns.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const filtered = paymentTxns.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Payments</h1>
        <button className="btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div className="info-banner" style={{ marginBottom: 16 }}>
        Payments complete automatically via M-Pesa callback. Use <strong>Manual Complete</strong> only if callback failed but you confirmed payment on M-Pesa.
      </div>

      <div className="filter-tabs">
        {[
          { key: 'pending', label: `Pending (${counts.pending})` },
          { key: 'completed', label: `Completed (${counts.completed})` },
          { key: 'failed', label: `Failed (${counts.failed})` },
          { key: 'all', label: `All (${paymentTxns.length})` },
        ].map(f => (
          <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading payments...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Phone</th><th>Type</th><th>Amount</th><th>M-Pesa Code</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.users?.full_name}</strong></td>
                  <td>{t.users?.phone}</td>
                  <td><span className="badge" style={{ textTransform: 'capitalize' }}>{t.type}</span></td>
                  <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {t.mpesa_code || <span style={{ color: '#64748b' }}>Pending</span>}
                  </td>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="action-btns">
                    {t.status === 'pending' && (
                      <>
                        <button className="btn-sm green" onClick={() => manualComplete(t)}>Complete</button>
                        <button className="btn-sm red" onClick={() => markFailed(t.id)}>Fail</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No {filter} payments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── WITHDRAWALS ─────────────────────────────────────────────────────────────
export const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/withdrawals').then(r => setWithdrawals(r.data.withdrawals)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleWithdrawal = async (id, action) => {
    setProcessing(id);
    try {
      let admin_note = '';
      if (action === 'reject') {
        admin_note = window.prompt('Rejection reason (amount will be refunded to user):') || '';
      } else if (action === 'mark_paid') {
        admin_note = window.prompt('Enter M-Pesa code or note:') || 'Paid manually';
      }
      await api.patch(`/admin/withdrawals/${id}`, { action, admin_note });
      const msgs = {
        approve: 'M-Pesa payout sent via Paystack!',
        mark_paid: 'Marked as paid manually',
        reject: 'Rejected — amount refunded to user wallet',
      };
      toast.success(msgs[action]);
      load();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to process';
      const hint = err.response?.data?.hint || '';
      toast.error(errMsg, { duration: 6000 });
      if (hint) setTimeout(() => toast(hint), 500);
    } finally {
      setProcessing(null);
    }
  };

  const counts = { pending: 0, paid: 0, rejected: 0 };
  withdrawals.forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++; });
  const filtered = withdrawals.filter(w => w.status === filter);
  const pendingTotal = withdrawals.filter(w => w.status === 'pending').reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Withdrawals</h1>
        <button className="btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {counts.pending > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <strong style={{ color: '#ef4444' }}>{counts.pending} pending withdrawal{counts.pending > 1 ? 's' : ''}</strong>
          <span style={{ color: '#94a3b8', marginLeft: 8 }}>— Total: KES {pendingTotal.toLocaleString()}</span>
        </div>
      )}

      <div className="filter-tabs">
        {[
          { key: 'pending', label: `Pending (${counts.pending})` },
          { key: 'paid', label: `Paid (${counts.paid})` },
          { key: 'rejected', label: `Rejected (${counts.rejected})` },
        ].map(f => (
          <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading withdrawals...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Package</th><th>Amount</th><th>M-Pesa Phone</th><th>Requested</th><th>Note</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id}>
                  <td>
                    <strong>{w.users?.full_name}</strong><br />
                    <small style={{ color: '#64748b' }}>{w.users?.phone}</small>
                  </td>
                  <td><span className="badge" style={{ textTransform: 'capitalize' }}>{w.users?.package_level}</span></td>
                  <td><strong style={{ color: '#22c55e', fontSize: '1.05rem' }}>KES {Number(w.amount).toLocaleString()}</strong></td>
                  <td style={{ fontWeight: 600 }}>{w.phone}</td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(w.requested_at).toLocaleDateString()}</td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 140 }}>{w.admin_note || '—'}</td>
                  <td className="action-btns">
                    {w.status === 'pending' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <button className="btn-sm green" onClick={() => handleWithdrawal(w.id, 'approve')} disabled={!!processing} title="Auto-pay via Paystack">
                          {processing === w.id ? '...' : 'Pay via M-Pesa'}
                        </button>
                        <button className="btn-sm" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => handleWithdrawal(w.id, 'mark_paid')} disabled={!!processing} title="You sent M-Pesa manually">
                          Mark Paid
                        </button>
                        <button className="btn-sm red" onClick={() => handleWithdrawal(w.id, 'reject')} disabled={!!processing}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className={`badge ${w.status}`}>{w.status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No {filter} withdrawals</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── ALL TRANSACTIONS ─────────────────────────────────────────────────────────
export const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/transactions').then(r => setTransactions(r.data.transactions)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const typeColors = {
    earning: '#22c55e', referral: '#6366f1', withdrawal: '#ef4444',
    deposit: '#3b82f6', activation: '#f59e0b', package: '#8b5cf6'
  };

  const filtered = transactions.filter(t => {
    const s = search.toLowerCase();
    const matchType = filter === 'all' || t.type === filter;
    const matchSearch = !search || t.users?.full_name?.toLowerCase().includes(s) || t.users?.phone?.includes(search);
    return matchType && matchSearch;
  });

  const total = filtered.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>All Transactions</h1>
        <button className="btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          className="search-input" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}
          placeholder="Search by user name or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-tabs" style={{ margin: 0 }}>
          {['all', 'activation', 'package', 'deposit', 'earning', 'referral', 'withdrawal'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p style={{ color: '#64748b', marginBottom: 12, fontSize: '0.85rem' }}>
        Showing {filtered.length} transactions — Total: <strong style={{ color: '#f1f5f9' }}>KES {total.toLocaleString()}</strong>
      </p>

      {loading ? <div className="loading">Loading transactions...</div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>M-Pesa Code</th><th>Description</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.users?.full_name}</strong><br />
                    <small style={{ color: '#64748b' }}>{t.users?.phone}</small>
                  </td>
                  <td>
                    <span className="badge" style={{ background: (typeColors[t.type] || '#64748b') + '22', color: typeColors[t.type] || '#64748b' }}>
                      {t.type}
                    </span>
                  </td>
                  <td><strong>KES {Number(t.amount).toLocaleString()}</strong></td>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8' }}>{t.mpesa_code || '—'}</td>
                  <td style={{ maxWidth: 200, fontSize: '0.82rem', color: '#94a3b8' }}>{t.description || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
