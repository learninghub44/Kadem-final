import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Kadem</h1>
          <p>Marketing Agency</p>
        </div>
        <h2>Sign In</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="you@email.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-link">Don't have an account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', password: '',
    referral_code: searchParams.get('ref') || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Success modal — join WhatsApp channel
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#22c55e', marginBottom: 8 }}>Account Created!</h2>
          <p style={{ marginBottom: 20, color: '#64748b' }}>
            Welcome to Kadem! Join our WhatsApp channel to get the latest updates, tasks, and announcements.
          </p>
          <a
            href="https://whatsapp.com/channel/0029VbD1tzELdQedEpwZ5841"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ display: 'block', background: '#25D366', marginBottom: 12, textDecoration: 'none' }}
          >
            Join WhatsApp Channel
          </a>
          <button
            className="btn-primary"
            style={{ background: '#6366f1' }}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
          <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>
            You can also join later from your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Kadem</h1>
          <p>Marketing Agency</p>
        </div>
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          {[
            { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'John Doe' },
            { label: 'Phone (M-Pesa)', key: 'phone', type: 'tel', placeholder: '0712345678' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'you@email.com' },
            { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 6 characters' },
            { label: 'Referral Code (optional)', key: 'referral_code', type: 'text', placeholder: 'e.g. ABC123' },
          ].map(field => (
            <div className="form-group" key={field.key}>
              <label>{field.label}</label>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={e => setForm({...form, [field.key]: e.target.value})}
                required={field.key !== 'referral_code'}
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-link">Already have an account? <Link to="/login">Sign In</Link></p>
      </div>
    </div>
  );
};
