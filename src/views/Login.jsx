import React, { useEffect, useState, startTransition } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, Loader2, ArrowRight, UserCircle, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useShallow } from 'zustand/react/shallow';

export const Login = () => {
  const navigate = useNavigate();
  const { login, loginAsGuest, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore(
    useShallow((state) => ({
      login: state.login,
      loginAsGuest: state.loginAsGuest,
      isAuthenticated: state.isAuthenticated,
      loading: state.loading,
      error: state.error,
      successMessage: state.successMessage,
      clearError: state.clearError,
      clearSuccess: state.clearSuccess,
    }))
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    clearError();
    clearSuccess();
  }, [clearError, clearSuccess]);

  useEffect(() => {
    if (isAuthenticated) {
      startTransition(() => {
        navigate('/', { replace: true });
      });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (localError) setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    const success = await login(email, password);
    if (success) {
      startTransition(() => {
        navigate('/', { replace: true });
      });
    }
  };

  const displayError = error || localError;

  return (
    <AuthLayout>
      {/* Card wrapper */}
      <div className="relative group w-full max-w-full min-w-0">
        {/* Ambient glow — hidden on very small screens to avoid overflow */}
        <div className="absolute -inset-[2px] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-indigo-500/20 rounded-[26px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 hidden sm:block pointer-events-none" />

        {/* Main card */}
        <div className="relative w-full box-border bg-slate-900/70 backdrop-blur-2xl border border-slate-800/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-9 shadow-2xl shadow-black/30">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-tight text-white">
              Welcome back
            </h2>
            <p className="text-slate-500 text-[13px] mt-1.5 font-medium">
              Sign in to your financial workspace
            </p>
          </div>

          {/* Alert Messages */}
          {displayError && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 animate-[fadeIn_0.25s_ease-out]">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-[7px] shrink-0" />
              <p className="text-red-300/90 text-xs font-medium leading-relaxed">{displayError}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 animate-[fadeIn_0.25s_ease-out]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-[7px] shrink-0" />
              <p className="text-emerald-300/90 text-xs font-medium leading-relaxed">{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
                Email
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-[15px] w-[15px] text-slate-600 group-focus-within/input:text-emerald-400 transition-colors" />
                </div>
                <input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 text-sm transition-all duration-200"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-slate-500 hover:text-emerald-400 transition-colors duration-200"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[15px] w-[15px] text-slate-600 group-focus-within/input:text-emerald-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 text-sm transition-all duration-200"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
          </div>

          {/* Guest Mode */}
          <button
            type="button"
            id="guest-login"
            onClick={async () => {
              const success = await loginAsGuest();
              if (success) {
                startTransition(() => {
                  navigate('/', { replace: true });
                });
              }
            }}
            className="w-full py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-sm rounded-xl focus:outline-none transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
          >
            <UserCircle className="h-4 w-4" />
            Explore as Guest
          </button>
          <p className="text-center text-[10px] text-slate-600 mt-2.5 tracking-wide">
            Read-only access · No credentials required
          </p>

          {/* Footer */}
          <div className="text-center mt-5 sm:mt-7 pt-5 sm:pt-6 border-t border-slate-800/50">
            <span className="text-slate-600 text-xs">New to AccuLedger? </span>
            <Link
              to="/signup"
              className="text-emerald-400/80 hover:text-emerald-300 text-xs font-bold transition-colors duration-200"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
