import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Smartphone, Upload, Wallet, ArrowDownCircle,
  ArrowUpCircle, Package, Users, Receipt, User, LogOut, Menu, X, Shield, Lock
} from 'lucide-react';

// Items requiring active account
const lockedItems = ['/dashboard/tasks', '/dashboard/upload', '/dashboard/deposit', '/dashboard/withdraw', '/dashboard/packages'];

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/tasks', icon: Smartphone, label: 'WhatsApp Tasks', locked: true },
  { to: '/dashboard/upload', icon: Upload, label: 'Upload Screenshot', locked: true },
  { to: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/dashboard/deposit', icon: ArrowDownCircle, label: 'Deposit', locked: true },
  { to: '/dashboard/withdraw', icon: ArrowUpCircle, label: 'Withdraw', locked: true },
  { to: '/dashboard/packages', icon: Package, label: 'Buy Package', locked: true },
  { to: '/dashboard/referrals', icon: Users, label: 'Referrals' },
  { to: '/dashboard/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/dashboard/profile', icon: User, label: 'Profile' },
];

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = user?.status === 'active';
  const statusColor = isActive ? '#22c55e' : '#f59e0b';

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-text">Kadem</span>
            <span className="logo-sub">Marketing</span>
          </div>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <div className="user-info">
          <div className="avatar">{user?.full_name?.[0]?.toUpperCase()}</div>
          <div>
            <p className="user-name">{user?.full_name}</p>
            <span className="status-badge" style={{ background: statusColor }}>
              {isActive ? '✅ ACTIVE' : '🔒 INACTIVE'}
            </span>
          </div>
        </div>

        <div className="wallet-pill">
          <span>Wallet</span>
          <strong>KES {Number(user?.wallet_balance || 0).toLocaleString()}</strong>
        </div>

        {/* Activation prompt in sidebar */}
        {!isActive && (
          <div style={{ margin: '8px 12px', background: '#1e293b', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ color: '#f59e0b', fontSize: 12, margin: '0 0 6px', fontWeight: 600 }}>🔒 Account Locked</p>
            <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 8px' }}>Activate to unlock all features</p>
            <button onClick={() => { navigate('/dashboard'); setSidebarOpen(false); }} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Activate — KES 550
            </button>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end, locked }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${locked && !user?.status === 'active' ? 'nav-locked' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {locked && !isActive && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink to="/admin" className="nav-item admin-link" onClick={() => setSidebarOpen(false)}>
              <Shield size={18} />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <button className="nav-item logout-btn" onClick={handleLogout}>
          <LogOut size={18} /><span>Logout</span>
        </button>
      </aside>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="topbar-right">
            {!isActive ? (
              <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                🔒 Account Locked
              </span>
            ) : (
              <span className="package-badge">{user?.package_level?.toUpperCase() || 'NO PACKAGE'}</span>
            )}
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
