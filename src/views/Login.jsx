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
      <div className="relative w-full max-w-full min-w-0">

        {/* Main card */}
        <div className="relative w-full box-border bg-slate-900/60 backdrop-blur-2xl border border-slate-800/60 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/20">

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-100">
              Welcome Back
            </h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              Sign in to your account to continue
            </p>
          </div>

          {/* Alert Messages */}
          {displayError && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 animate-[fadeIn_0.25s_ease-out]">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-[7px] shrink-0" />
              <p className="text-red-300/90 text-xs font-medium leading-relaxed">{displayError}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 animate-[fadeIn_0.25s_ease-out]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-[7px] shrink-0" />
              <p className="text-emerald-300/90 text-xs font-medium leading-relaxed">{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 tracking-wide uppercase">
                Email Address
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-600 group-focus-within/input:text-brand-400 transition-colors duration-200" />
                </div>
                <input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  title="Please enter a valid email address (e.g. name@company.com)"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 text-sm transition-all duration-300 font-medium"
                  placeholder="name@company.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 tracking-wide uppercase">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-slate-500 hover:text-brand-400 transition-colors duration-200"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-600 group-focus-within/input:text-brand-400 transition-colors duration-200" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  pattern="^.{6,}$"
                  title="Password must be at least 6 characters long."
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 text-sm transition-all duration-300 font-medium"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-slate-300 transition-colors duration-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="h-[18px] w-[18px]" />
                    : <Eye className="h-[18px] w-[18px]" />
                  }
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="group/btn w-full py-3.5 px-4 bg-[#482F1E] hover:bg-[#5A3D28] active:scale-[0.98] text-white font-semibold text-sm rounded-2xl shadow-lg shadow-[#482F1E]/30 hover:shadow-xl hover:shadow-[#482F1E]/40 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
            <p className="text-xs text-slate-600 font-medium">
              Protected by enterprise-grade encryption
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
