import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Wallet, TrendingUp, Users, Package, AlertCircle, Lock } from 'lucide-react';

const PACKAGES = [
  { name: 'starter', price: 100, multiplier: '1x', color: '#6366f1' },
  { name: 'bronze', price: 500, multiplier: '1.5x', color: '#cd7f32' },
  { name: 'silver', price: 1500, multiplier: '2x', color: '#94a3b8' },
  { name: 'gold', price: 2999, multiplier: '3x', color: '#f59e0b' },
];

// Locked overlay for inactive users
const LockedBanner = ({ onActivate, activating }) => (
  <div style={{
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    border: '2px solid #f59e0b',
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    marginBottom: 24,
  }}>
    <Lock size={48} color="#f59e0b" style={{ marginBottom: 12 }} />
    <h2 style={{ color: '#f59e0b', marginBottom: 8 }}>Dashboard Locked</h2>
    <p style={{ color: '#94a3b8', marginBottom: 8 }}>
      Your account is not yet activated. Pay the one-time activation fee of <strong style={{ color: '#fff' }}>KES 550</strong> to unlock all features.
    </p>
    <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
      ✅ Access tasks &nbsp;|&nbsp; ✅ Earn per view &nbsp;|&nbsp; ✅ Referral bonuses &nbsp;|&nbsp; ✅ Withdrawals
    </p>
    <button
      className="btn-activate"
      onClick={onActivate}
      disabled={activating}
      style={{ fontSize: 16, padding: '12px 32px' }}
    >
      {activating ? '⏳ Sending STK Push...' : '🔓 Activate Account — KES 550'}
    </button>
    <p style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
      M-Pesa STK push will be sent to your registered phone number.
    </p>
  </div>
);

const DashboardHome = () => {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [activating, setActivating] = useState(false);
  const navigate = useNavigate();

  const isActive = user?.status === 'active';

  const loadStats = useCallback(async () => {
    try {
      const [walletRes, subsRes] = await Promise.all([
        api.get('/user/wallet'),
        isActive ? api.get('/tasks/my-submissions') : Promise.resolve({ data: { submissions: [] } }),
      ]);
      const subs = subsRes.data.submissions || [];
      setStats({
        balance: walletRes.data.wallet_balance,
        totalEarned: subs.filter(s => s.status === 'approved').reduce((a, b) => a + Number(b.earning_amount), 0),
        pendingSubmissions: subs.filter(s => s.status === 'pending').length,
        approvedSubmissions: subs.filter(s => s.status === 'approved').length,
      });
    } catch {}
  }, [isActive]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await api.post('/payments/activate');
      toast.success('✅ STK Push sent! Check your phone and enter your M-Pesa PIN.');
      // Poll for activation
      const poll = setInterval(async () => {
        const updated = await refreshUser();
        if (updated?.status === 'active') {
          clearInterval(poll);
          toast.success('🎉 Account activated! You can now access all features.');
        }
      }, 5000);
      setTimeout(() => clearInterval(poll), 60000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Activation failed. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="dashboard-home">
      <h1 className="page-title">Welcome, {user?.full_name?.split(' ')[0]} 👋</h1>

      {/* Locked Banner for inactive users */}
      {!isActive && <LockedBanner onActivate={handleActivate} activating={activating} />}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <Wallet size={24} className="stat-icon" />
          <div>
            <p className="stat-label">Wallet Balance</p>
            <h3>KES {Number(user?.wallet_balance || 0).toLocaleString()}</h3>
          </div>
        </div>
        <div className={`stat-card ${!isActive ? 'stat-locked' : ''}`}>
          <TrendingUp size={24} className="stat-icon green" />
          <div>
            <p className="stat-label">Total Earned</p>
            <h3>{isActive ? `KES ${Number(stats?.totalEarned || 0).toLocaleString()}` : '🔒 Locked'}</h3>
          </div>
        </div>
        <div className={`stat-card ${!isActive ? 'stat-locked' : ''}`}>
          <Users size={24} className="stat-icon blue" />
          <div>
            <p className="stat-label">Pending Tasks</p>
            <h3>{isActive ? (stats?.pendingSubmissions || 0) : '🔒 Locked'}</h3>
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

      {/* Package prompt for active users with no package */}
      {isActive && user?.package_level === 'none' && (
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

      {/* Quick Actions — only for active users */}
      {isActive && (
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

      {/* WhatsApp Channel CTA */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #25D366',
        borderRadius: 12,
        padding: '16px 20px',
        marginTop: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>📢</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>Stay Updated</p>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Join our WhatsApp channel for tasks & announcements</p>
        </div>
        <a
          href="https://whatsapp.com/channel/0029VbD1tzELdQedEpwZ5841"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#25D366',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Join Now
        </a>
      </div>
    </div>
  );
};

export default DashboardHome;
