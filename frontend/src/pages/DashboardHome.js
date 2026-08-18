import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, Users, Package, Lock, Smartphone,
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react';

const PACKAGES = [
  { name: 'starter', price: 100, multiplier: '1x', color: '#6366f1' },
  { name: 'bronze', price: 500, multiplier: '1.5x', color: '#cd7f32' },
  { name: 'silver', price: 1500, multiplier: '2x', color: '#94a3b8' },
  { name: 'gold', price: 2999, multiplier: '3x', color: '#f59e0b' },
];

const WAIT_WINDOW_MS = 90 * 1000;

// Visual config per phase — icon, colors, headline, body copy
const PHASE_META = {
  idle: { icon: Lock, tone: '#f59e0b', title: 'Activate Your Account', body: 'Pay a one-time fee to unlock all features.' },
  sending: { icon: Loader2, tone: '#f59e0b', title: 'Sending STK Push...', body: 'Requesting a payment prompt from M-Pesa.' },
  waiting: { icon: Smartphone, tone: '#f59e0b', title: 'Check Your Phone', body: 'Enter your M-Pesa PIN to complete payment.' },
  done: { icon: CheckCircle2, tone: '#22c55e', title: 'Payment Received', body: 'Unlocking your account...' },
  cancelled: { icon: XCircle, tone: '#f87171', title: 'Payment Cancelled', body: 'You cancelled the M-Pesa prompt.' },
  timeout: { icon: Clock, tone: '#f87171', title: 'PIN Not Entered', body: "You didn't enter your M-Pesa PIN in time." },
  failed: { icon: AlertTriangle, tone: '#f87171', title: 'Payment Failed', body: 'The payment could not be completed.' },
};

const ActivationScreen = ({ user }) => {
  const { refreshUser, logout } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [phase, setPhase] = useState('idle');
  const [msWaited, setMsWaited] = useState(0);
  const timersRef = useRef({ poll: null, hardStop: null, tick: null });

  const stopTimers = () => {
    const t = timersRef.current;
    if (t.poll) clearInterval(t.poll);
    if (t.hardStop) clearTimeout(t.hardStop);
    if (t.tick) clearInterval(t.tick);
  };
  useEffect(() => () => stopTimers(), []);

  const handleActivate = async () => {
    if (!phone || !/^(07|01)\d{8}$/.test(phone.trim())) {
      toast.error('Enter a valid M-Pesa number (07XXXXXXXX)');
      return;
    }
    setPhase('sending');
    try {
      const res = await api.post('/payments/activate', { phone: phone.trim() });
      const reference = res.data.reference;
      setPhase('waiting');

      const started = Date.now();
      const POLL_MS = 4000;
      const VERIFY_AFTER_MS = 25000;
      let verified = false;

      timersRef.current.tick = setInterval(() => setMsWaited(Date.now() - started), 500);

      const finish = (status, reason) => {
        stopTimers();
        const meta = status === 'completed' ? 'done' : (reason || 'failed');
        setPhase(meta);
        if (status === 'completed') toast.success('Payment received!');
        else toast.error(PHASE_META[meta]?.body || 'Payment did not go through.');
        if (status === 'completed') refreshUser();
      };

      timersRef.current.poll = setInterval(async () => {
        const elapsed = Date.now() - started;
        if (elapsed > WAIT_WINDOW_MS) return;
        try {
          const { data } = await api.get(`/payments/status/${reference}`);
          if (data.status === 'completed') return finish('completed');
          if (data.status === 'failed') return finish('failed', 'failed');

          if (elapsed >= VERIFY_AFTER_MS && !verified) {
            verified = true;
            try {
              const { data: v } = await api.post(`/payments/verify/${reference}`);
              if (v.status === 'completed') return finish('completed');
              if (v.status === 'failed') return finish('failed', v.reason || 'failed');
            } catch { /* transient — keep polling */ }
          }
        } catch { /* transient — keep polling */ }
      }, POLL_MS);

      timersRef.current.hardStop = setTimeout(async () => {
        try {
          const { data: v } = await api.post(`/payments/verify/${reference}`);
          if (v.status === 'completed') return finish('completed');
          finish('failed', v.reason || 'timeout');
        } catch {
          finish('failed', 'timeout');
        }
      }, WAIT_WINDOW_MS + 2000);
    } catch (err) {
      setPhase('idle');
      toast.error(err.response?.data?.error || 'Activation failed. Please try again.');
    }
  };

  const isBusy = phase === 'sending' || phase === 'waiting';
  const isOutcome = ['cancelled', 'timeout', 'failed'].includes(phase);
  const meta = PHASE_META[phase];
  const Icon = meta.icon;
  const secondsLeft = Math.max(0, Math.ceil((WAIT_WINDOW_MS - msWaited) / 1000));
  const progressPct = phase === 'waiting' ? Math.min(100, (msWaited / WAIT_WINDOW_MS) * 100) : 0;

  return (
    <div style={{
      minHeight: '100vh', minHeight: '100dvh',
      background: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 60%)',
      boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px', paddingTop: 'clamp(24px, 6vh, 48px)', paddingBottom: 32,
      overflowY: 'auto',
    }}>
      <style>{`@keyframes kadem-spin { to { transform: rotate(360deg); } }`}</style>

      <button
        onClick={() => logout()}
        style={{
          position: 'fixed', top: 12, right: 16,
          background: 'none', border: 'none',
          color: '#64748b', cursor: 'pointer', fontSize: '0.8rem', zIndex: 10,
        }}
      >
        Logout
      </button>

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `${meta.tone}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Icon
            size={30}
            color={meta.tone}
            style={phase === 'sending' ? { animation: 'kadem-spin 1s linear infinite' } : undefined}
          />
        </div>

        <h1 style={{ color: meta.tone, fontSize: '1.25rem', marginBottom: 6, fontWeight: 700 }}>
          {meta.title}
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: 4, fontSize: '0.9rem' }}>
          {meta.body}
        </p>

        {phase === 'idle' && (
          <div style={{
            fontSize: 'clamp(1.8rem, 7vw, 2.2rem)', fontWeight: 800, color: '#fff',
            margin: '14px 0', fontFamily: 'Sora, sans-serif',
          }}>
            KES 150
          </div>
        )}

        {(phase === 'idle' || isOutcome) && (
          <div style={{ width: '100%', margin: '18px 0 4px', textAlign: 'left' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: '0.85rem' }}>
              M-Pesa Phone Number
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={18} color="#64748b" style={{ flexShrink: 0 }} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0712345678"
                style={{
                  flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 10,
                  border: '1px solid #334155', background: '#0f172a', color: '#fff',
                  fontSize: '1rem', outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div style={{ margin: '20px 0 4px' }}>
            <div style={{ height: 6, borderRadius: 3, background: '#1e293b', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`, background: '#f59e0b',
                transition: 'width 0.5s linear', borderRadius: 3,
              }} />
            </div>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 8 }}>
              Waiting for confirmation — {secondsLeft}s left
            </p>
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={isBusy}
          style={{
            width: '100%', marginTop: 18, padding: '14px 0', borderRadius: 12, border: 'none',
            background: isBusy ? '#92400e' : (isOutcome ? '#334155' : '#f59e0b'),
            color: isBusy ? '#fde68a' : (isOutcome ? '#fff' : '#000'),
            fontSize: '1rem', fontWeight: 700,
            cursor: isBusy ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}
        >
          {phase === 'sending' ? 'Sending STK Push...'
            : phase === 'waiting' ? 'Waiting for PIN...'
            : phase === 'done' ? 'Done'
            : isOutcome ? 'Try Again'
            : 'Pay Now'}
        </button>

        {phase === 'done' && (
          <p style={{ color: '#22c55e', fontSize: '0.9rem', marginTop: 14, fontWeight: 600 }}>
            Your payment was received. Redirecting...
          </p>
        )}

        {phase === 'idle' && (
          <p style={{ color: '#475569', fontSize: '0.78rem', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ShieldCheck size={13} /> Secured by M-Pesa
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
