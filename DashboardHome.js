import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Wallet, TrendingUp, Users, Package, AlertCircle } from 'lucide-react';

const PACKAGES = [
  { name: 'starter', price: 100, multiplier: '1x', color: '#6366f1' },
  { name: 'bronze', price: 500, multiplier: '1.5x', color: '#cd7f32' },
  { name: 'silver', price: 1500, multiplier: '2x', color: '#94a3b8' },
  { name: 'gold', price: 2999, multiplier: '3x', color: '#f59e0b' },
];

const DashboardHome = () => {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [activating, setActivating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [walletRes, subsRes] = await Promise.all([
        api.get('/user/wallet'),
        user?.status === 'active' ? api.get('/tasks/my-submissions') : Promise.resolve({ data: { submissions: [] } }),
      ]);
      const subs = subsRes.data.submissions || [];
      setStats({
        balance: walletRes.data.wallet_balance,
        totalEarned: subs.filter(s => s.status === 'approved').reduce((a, b) => a + Number(b.earning_amount), 0),
        pendingSubmissions: subs.filter(s => s.status === 'pending').length,
        approvedSubmissions: subs.filter(s => s.status === 'approved').length,
      });
    } catch {}
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await api.post('/payments/activate');
      toast.success('STK Push sent! Check your phone and enter M-Pesa PIN.');
      setTimeout(() => refreshUser(), 5000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="dashboard-home">
      <h1 className="page-title">Welcome, {user?.full_name?.split(' ')[0]} 👋</h1>

      {/* Activation Banner */}
      {user?.status === 'inactive' && (
        <div className="activation-banner">
          <AlertCircle size={20} />
          <div>
            <strong>Activate your account</strong>
            <p>Pay KES 550 via M-Pesa to unlock all features and start earning.</p>
          </div>
          <button className="btn-activate" onClick={handleActivate} disabled={activating}>
            {activating ? 'Sending STK...' : 'Activate — KES 550'}
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <Wallet size={24} className="stat-icon" />
          <div>
            <p className="stat-label">Wallet Balance</p>
            <h3>KES {Number(user?.wallet_balance || 0).toLocaleString()}</h3>
          </div>
        </div>
        <div className="stat-card">
          <TrendingUp size={24} className="stat-icon green" />
          <div>
            <p className="stat-label">Total Earned</p>
            <h3>KES {Number(stats?.totalEarned || 0).toLocaleString()}</h3>
          </div>
        </div>
        <div className="stat-card">
          <Users size={24} className="stat-icon blue" />
          <div>
            <p className="stat-label">Pending Tasks</p>
            <h3>{stats?.pendingSubmissions || 0}</h3>
          </div>
        </div>
        <div className="stat-card">
          <Package size={24} className="stat-icon gold" />
          <div>
            <p className="stat-label">Package</p>
            <h3>{user?.package_level?.toUpperCase() || 'NONE'}</h3>
          </div>
        </div>
      </div>

      {/* Packages */}
      {user?.status === 'active' && user?.package_level === 'none' && (
        <div className="packages-section">
          <h2>Choose a Package to Start Earning</h2>
          <div className="packages-grid">
            {PACKAGES.map(pkg => (
              <div key={pkg.name} className="package-card" style={{ borderColor: pkg.color }}>
                <div className="pkg-name" style={{ color: pkg.color }}>{pkg.name.toUpperCase()}</div>
                <div className="pkg-price">KES {pkg.price.toLocaleString()}</div>
                <div className="pkg-multiplier">{pkg.multiplier} earnings</div>
                <button className="btn-pkg" style={{ background: pkg.color }} onClick={() => navigate('/dashboard/packages')}>
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {user?.status === 'active' && (
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <button className="action-card" onClick={() => navigate('/dashboard/tasks')}>
              📲 View Tasks
            </button>
            <button className="action-card" onClick={() => navigate('/dashboard/upload')}>
              📸 Upload Screenshot
            </button>
            <button className="action-card" onClick={() => navigate('/dashboard/referrals')}>
              👥 Share Referral
            </button>
            <button className="action-card" onClick={() => navigate('/dashboard/withdraw')}>
              💸 Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
