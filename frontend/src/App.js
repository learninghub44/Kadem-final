import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { LoginPage, RegisterPage, AdminLoginPage } from './pages/AuthPages';
import DashboardHome from './pages/DashboardHome';
import {
  TasksPage, UploadPage, WalletPage, DepositPage,
  WithdrawPage, PackagesPage, ReferralsPage, ProfilePage
} from './pages/UserPages';
import {
  AdminLayout, AdminOverview, AdminUsers, AdminTasks,
  AdminSubmissions, AdminPayments, AdminWithdrawals, AdminTransactions
} from './pages/AdminPages';
import './styles.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/admin/login" element={<PublicRoute><AdminLoginPage /></PublicRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="deposit" element={<DepositPage />} />
        <Route path="withdraw" element={<WithdrawPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="transactions" element={<WalletPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="submissions" element={<AdminSubmissions />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="transactions" element={<AdminTransactions />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
