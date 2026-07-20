import React, { useEffect, useState, startTransition } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useShallow } from 'zustand/react/shallow';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore(
    useShallow((state) => ({
      login: state.login,
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

    if (!/^[\w.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long');
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
        {/* Ambient glow - hidden on very small screens to avoid overflow */}
        <div className="absolute -inset-[2px] bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-amber-500/20 rounded-[26px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 hidden sm:block pointer-events-none" />

        {/* Main card */}
        <div className="relative w-full box-border bg-slate-800/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-600/40 dark:border-slate-800/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-9 shadow-2xl shadow-black/10 dark:shadow-black/30">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-tight text-slate-100">
              Welcome Back
            </h2>
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
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 dark:text-slate-400 mb-1.5">
                Email
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-[15px] w-[15px] text-slate-400 dark:text-slate-600 group-focus-within/input:text-amber-400 transition-colors" />
                </div>
                <input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  title="Please enter a valid email address (e.g. name@company.com)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-700/50 dark:bg-slate-950/60 border border-slate-500/50 dark:border-slate-800 text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all duration-200 font-medium"
                  placeholder="name@company.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 dark:text-slate-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-slate-300 dark:text-slate-500 hover:text-amber-400 transition-colors duration-200"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[15px] w-[15px] text-slate-400 dark:text-slate-600 group-focus-within/input:text-amber-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  pattern="^.{6,}$"
                  title="Password must be at least 6 characters long."
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-700/50 dark:bg-slate-950/60 border border-slate-500/50 dark:border-slate-800 text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all duration-200 font-medium"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-600 hover:text-slate-200 dark:hover:text-slate-300 transition-colors cursor-pointer"
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
              className="w-full py-3 px-4 bg-[#482F1E] hover:bg-[#5A3D28] active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#482F1E]/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
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
        </div>
      </div>
    </AuthLayout>
  );
};
