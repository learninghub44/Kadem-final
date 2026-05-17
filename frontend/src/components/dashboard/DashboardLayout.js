import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Smartphone, Upload, Wallet, ArrowDownCircle,
  ArrowUpCircle, Package, Users, Receipt, User, LogOut, Menu, X, Shield, Lock
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true, locked: false },
  { to: '/dashboard/tasks', icon: Smartphone, label: 'WhatsApp Tasks', locked: true },
  { to: '/dashboard/upload', icon: Upload, label: 'Upload Screenshot', locked: true },
  { to: '/dashboard/packages', icon: Package, label: 'Buy Package', locked: true },
  { to: '/dashboard/deposit', icon: ArrowDownCircle, label: 'Deposit', locked: true },
  { to: '/dashboard/withdraw', icon: ArrowUpCircle, label: 'Withdraw', locked: true },
  { to: '/dashboard/wallet', icon: Wallet, label: 'Wallet', locked: false },
  { to: '/dashboard/referrals', icon: Users, label: 'Referrals', locked: false },
  { to: '/dashboard/transactions', icon: Receipt, label: 'Transactions', locked: false },
  { to: '/dashboard/profile', icon: User, label: 'Profile', locked: false },
];

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = user?.status === 'active';

  const handleNavClick = (locked, e) => {
    setSidebarOpen(false);
    if (locked && !isActive) {
      e.preventDefault();
      navigate('/dashboard');
    }
  };

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
            <span className="status-badge" style={{ background: isActive ? '#22c55e' : '#f59e0b' }}>
              {isActive ? '✅ ACTIVE' : '🔒 INACTIVE'}
            </span>
          </div>
        </div>

        <div className="wallet-pill">
          <span>Wallet</span>
          <strong>KES {Number(user?.wallet_balance || 0).toLocaleString()}</strong>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end, locked }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive: active }) =>
                `nav-item ${active ? 'active' : ''} ${locked && !isActive ? 'nav-locked' : ''}`
              }
              onClick={(e) => handleNavClick(locked, e)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {locked && !isActive && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <NavLink to="/admin" className="nav-item admin-link" onClick={() => setSidebarOpen(false)}>
              <Shield size={18} /><span>Admin Panel</span>
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
            {!isActive && (
              <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                🔒 Account Locked
              </span>
            )}
            {isActive && user?.package_level && user.package_level !== 'none' && (
              <span className="package-badge">{user.package_level.toUpperCase()}</span>
            )}
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
};
