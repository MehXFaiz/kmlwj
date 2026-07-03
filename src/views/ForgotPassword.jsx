import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const { forgotPassword, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore();

  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    clearError();
    clearSuccess();
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email) {
      setLocalError('Please fill in your email address');
      return;
    }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    await forgotPassword(email);
  };

  return (
    <AuthLayout>
      <div className="relative group w-full max-w-full min-w-0">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-600 to-rose-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 hidden sm:block pointer-events-none"></div>
        
        <div className="relative w-full box-border bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 shadow-2xl">
          <div className="mb-5 sm:mb-6">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors mb-3 sm:mb-4">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-rose-400">
              Recover Access
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              Enter your email to receive a secure password reset token
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
            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Registered Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                  title="Please enter a valid email address (e.g. name@company.com)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Request Link Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-rose-600 hover:from-indigo-400 hover:to-rose-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate Reset Credentials'
              )}
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};
