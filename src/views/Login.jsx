import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    const success = await login(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <AuthLayout>
      <div className="relative group">
        {/* Glow effect behind the login card */}
        <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-600 to-indigo-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        
        {/* Glassmorphic Card */}
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400">
              ERP Accounting
            </h2>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              Secure Ledger Access & Financial Terminal
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-emerald-500/10 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Enter Terminal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer link to register */}
          <div className="text-center mt-6">
            <span className="text-slate-500 text-xs">Don't have access? </span>
            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors"
            >
              Request Credentials
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
