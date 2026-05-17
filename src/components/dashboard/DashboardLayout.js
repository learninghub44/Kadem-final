import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Smartphone, Upload, Wallet, ArrowDownCircle,
  ArrowUpCircle, Package, Users, Receipt, User, LogOut, Menu, X, Shield
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/tasks', icon: Smartphone, label: 'WhatsApp Tasks' },
  { to: '/dashboard/upload', icon: Upload, label: 'Upload Screenshot' },
  { to: '/dashboard/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/dashboard/deposit', icon: ArrowDownCircle, label: 'Deposit' },
  { to: '/dashboard/withdraw', icon: ArrowUpCircle, label: 'Withdraw' },
  { to: '/dashboard/packages', icon: Package, label: 'Buy Package' },
  { to: '/dashboard/referrals', icon: Users, label: 'Referrals' },
  { to: '/dashboard/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/dashboard/profile', icon: User, label: 'Profile' },
];

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const statusColor = user?.status === 'active' ? '#22c55e' : '#f59e0b';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
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
              {user?.status?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="wallet-pill">
          <span>Wallet</span>
          <strong>KES {Number(user?.wallet_balance || 0).toLocaleString()}</strong>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Icon size={18} />
              <span>{label}</span>
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
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="topbar-right">
            <span className="package-badge">{user?.package_level?.toUpperCase() || 'NO PACKAGE'}</span>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
