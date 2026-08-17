import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Wallet, TrendingUp, Users, Package, Lock, Smartphone } from 'lucide-react';

const PACKAGES = [
  { name: 'starter', price: 100, multiplier: '1x', color: '#6366f1' },
  { name: 'bronze', price: 500, multiplier: '1.5x', color: '#cd7f32' },
  { name: 'silver', price: 1500, multiplier: '2x', color: '#94a3b8' },
  { name: 'gold', price: 2999, multiplier: '3x', color: '#f59e0b' },
];

const ActivationScreen = ({ user }) => {
  const { refreshUser, logout } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [phase, setPhase] = useState('idle'); // idle | sending | waiting | done
  const [notice, setNotice] = useState('');

  const handleActivate = async () => {
    if (!phone || !/^(07|01)\d{8}$/.test(phone.trim())) {
      toast.error('Enter a valid M-Pesa number (07XXXXXXXX)');
      return;
    }
    setPhase('sending');
    setNotice('');
    try {
      const res = await api.post('/payments/activate', { phone: phone.trim() });
      const reference = res.data.reference;
      toast.success('Check your phone and enter your M-Pesa PIN.');
      setPhase('waiting');

      const started = Date.now();
      const POLL_MS = 3000;
      const TIMEOUT_MS = 75000;
      let poll = null;
      let hardStop = null;

      const stopTimers = () => {
        if (poll) clearInterval(poll);
        if (hardStop) clearTimeout(hardStop);
      };

      const finish = (status, msg) => {
        stopTimers();
        if (status === 'completed') {
          setPhase('done');
          setNotice(msg);
          toast.success(msg);
        } else {
          setPhase('idle');
          setNotice(msg);
          toast.error(msg);
        }
      };

      poll = setInterval(async () => {
        if (Date.now() - started > TIMEOUT_MS) return;
        try {
          const { data } = await api.get(`/payments/status/${reference}`);
          if (data.status === 'completed') {
            await refreshUser();
            finish('completed', 'Payment received! Account activated.');
          } else if (data.status === 'failed') {
            finish('failed', 'You have cancelled or not entered the PIN. Please try again.');
          }
        } catch { /* transient — keep polling */ }
      }, POLL_MS);

      hardStop = setTimeout(async () => {
        try {
          const { data } = await api.get(`/payments/status/${reference}`);
          if (data.status === 'completed') {
            await refreshUser();
            finish('completed', 'Payment received! Account activated.');
          } else {
            finish('failed', 'You have cancelled or not entered the PIN. Please try again.');
          }
        } catch {
          finish('failed', 'Timeout. Please try again.');
        }
      }, TIMEOUT_MS + 3000);
    } catch (err) {
      setPhase('idle');
      toast.error(err.response?.data?.error || 'Activation failed. Please try again.');
    }
  };

  const waiting = phase === 'sending' || phase === 'waiting';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #f59e0b',
        borderRadius: 18,
        padding: 'clamp(20px, 4vh, 32px)',
        textAlign: 'center',
        maxWidth: 'min(400px, 94vw)',
        width: '100%',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        <button
          onClick={() => { logout(); }}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none',
            color: '#64748b', cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          Logout
        </button>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Lock size={32} color="#f59e0b" />
        </div>

        <h1 style={{ color: '#f59e0b', fontSize: '1.35rem', marginBottom: 6 }}>
          Activate Your Account
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: 6, fontSize: '0.9rem' }}>
          Pay a one-time fee to unlock all features.
        </p>
        <div style={{
          fontSize: 'clamp(1.8rem, 7vw, 2.2rem)',
          fontWeight: 800,
          color: '#fff',
          margin: '14px 0',
          fontFamily: 'Sora, sans-serif',
        }}>
          KES 150
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', textAlign: 'left', color: '#94a3b8', marginBottom: 6, fontSize: '0.85rem' }}>
            M-Pesa Phone Number
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="#64748b" />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0712345678"
              disabled={waiting}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleActivate}
          disabled={waiting}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 12,
            border: 'none',
            background: waiting ? '#92400e' : '#f59e0b',
            color: waiting ? '#fde68a' : '#000',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: waiting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {phase === 'sending'
            ? 'Sending STK Push...'
            : phase === 'waiting'
              ? 'Waiting for PIN...'
              : phase === 'done'
                ? 'Done'
                : 'Pay Now'}
        </button>

        {phase === 'waiting' && (
          <p style={{
            color: '#fbbf24', fontSize: '0.95rem', marginTop: 18, fontWeight: 600,
          }}>
            Check your phone and enter your M-Pesa PIN to complete payment.
          </p>
        )}

        {phase === 'done' && (
          <p style={{ color: '#22c55e', fontSize: '0.95rem', marginTop: 18, fontWeight: 600 }}>
            Your payment was received. Unlocking your account...
          </p>
        )}

        {notice && phase === 'idle' && (
          <p style={{
            color: '#f87171', fontSize: '0.9rem', marginTop: 18,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            {notice}
          </p>
        )}

        {phase === 'idle' && !notice && (
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 16 }}>
            An M-Pesa prompt will be sent to the number above.
            <br />Enter your PIN to complete payment.
          </p>
        )}
      </div>
    </div>
  );
};

const DashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  const isActive = user?.status === 'active';

  const loadStats = useCallback(async () => {
    if (!isActive) return;
    try {
      const [walletRes, subsRes] = await Promise.all([
        api.get('/user/wallet'),
        api.get('/tasks/my-submissions'),
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

  if (!isActive) {
    return <ActivationScreen user={user} />;
  }

  return (
    <div className="dashboard-home">
      <h1 className="page-title">Welcome, {user?.full_name?.split(' ')[0]}</h1>

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

      {user?.package_level === 'none' && (
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

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <button className="action-card" onClick={() => navigate('/dashboard/tasks')}>
            View Tasks
          </button>
          <button className="action-card" onClick={() => navigate('/dashboard/upload')}>
            Upload Screenshot
          </button>
          <button className="action-card" onClick={() => navigate('/dashboard/referrals')}>
            Share Referral
          </button>
          <button className="action-card" onClick={() => navigate('/dashboard/withdraw')}>
            Withdraw
          </button>
        </div>
      </div>

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
