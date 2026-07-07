import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    clearError();
    clearSuccess();
    if (isAuthenticated) {
      navigate('/');
    }
    if (!token) {
      setLocalError('Reset token is missing from URL parameters. Please check your email link.');
    }
  }, [isAuthenticated, token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!token) {
      setLocalError('Reset token is missing');
      return;
    }

    if (!password || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    const success = await resetPassword(token, password);
    if (success) {
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    }
  };

  return (
    <AuthLayout>
      <div className="relative group w-full max-w-full min-w-0">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-600 to-amber-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 hidden sm:block pointer-events-none"></div>
        
        <div className="relative w-full box-border bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 shadow-2xl">
          <div className="mb-5 sm:mb-6">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors mb-3 sm:mb-4">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-amber-400">
              Reset Password
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              Configure a secure new password for your operator account
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-semibold leading-relaxed animate-fade-in">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-semibold leading-relaxed animate-fade-in">
              {successMessage}
            </div>
          )}

          {localError && (
            <div className="mb-5 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-semibold leading-relaxed animate-fade-in">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  pattern="^.{8,}$"
                  title="Password must be at least 8 characters long."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all font-medium"
                  placeholder="••••••••"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  pattern="^.{8,}$"
                  title="Password must be at least 8 characters long."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all font-medium"
                  placeholder="••••••••"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 px-4 mt-2 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Commit Password Reset'
              )}
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};
