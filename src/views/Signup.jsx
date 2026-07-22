import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Mail, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';

export const Signup = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

    if (!email || !password || !name) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (!/^[a-zA-Z\s.-]{3,50}$/.test(name)) {
      setLocalError('Name must contain only letters, spaces, hyphens, and dots (3-50 characters)');
      return;
    }

    if (!/^[\w.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    const success = await register(email, password, name);
    if (success) {
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    }
  };

  const displayError = error || localError;

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { width: '0%', color: 'bg-slate-800', label: '' };
    if (password.length < 4) return { width: '25%', color: 'bg-red-500', label: 'Weak' };
    if (password.length < 8) return { width: '50%', color: 'bg-amber-500', label: 'Fair' };
    if (password.length < 12) return { width: '75%', color: 'bg-blue-500', label: 'Good' };
    return { width: '100%', color: 'bg-emerald-500', label: 'Strong' };
  };
  const strength = getPasswordStrength();

  return (
    <AuthLayout>
      {/* Card wrapper */}
      <div className="relative group w-full max-w-full min-w-0">
        <div className="absolute -inset-[2px] bg-gradient-to-r from-amber-500/20 via-blue-500/20 to-emerald-500/20 rounded-[26px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 hidden sm:block pointer-events-none" />

        <div className="relative w-full box-border bg-slate-900/70 backdrop-blur-2xl border border-slate-800/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-9 shadow-2xl shadow-black/30">
          {/* Back nav */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors duration-200 mb-4 sm:mb-6"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </Link>

          {/* Header */}
          <div className="mb-5 sm:mb-7">
            <h2 className="text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-tight text-white">
              Create account
            </h2>
            <p className="text-slate-500 text-[13px] mt-1.5 font-medium">
              Set up your operator credentials for the ledger
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Full Name
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-[15px] w-[15px] text-slate-600 group-focus-within/input:text-amber-400 transition-colors" />
                </div>
                <input
                  type="text"
                  id="signup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  pattern="^[a-zA-Z\s.-]{3,50}$"
                  title="Name must contain only letters, spaces, hyphens, and dots (3-50 characters)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all duration-200 font-medium"
                  placeholder="John Doe"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-[15px] w-[15px] text-slate-600 group-focus-within/input:text-amber-400 transition-colors" />
                </div>
                <input
                  type="email"
                  id="signup-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  pattern="^[\w.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                  title="Please enter a valid email address (e.g. name@company.com)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all duration-200 font-medium"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password with strength meter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[15px] w-[15px] text-slate-600 group-focus-within/input:text-amber-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="signup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$"
                  title="Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a digit."
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all duration-200 font-medium"
                  placeholder="Min 8 chars, upper + lower + digit"
                  autoComplete="new-password"
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
              {/* Strength bar */}
              {password && (
                <div className="flex items-center gap-2.5 mt-1.5">
                  <div className="flex-1 h-1 bg-slate-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} rounded-full transition-all duration-500`}
                      style={{ width: strength.width }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider uppercase ${
                    strength.color === 'bg-red-500' ? 'text-red-400' :
                    strength.color === 'bg-amber-500' ? 'text-amber-400' :
                    strength.color === 'bg-blue-500' ? 'text-blue-400' :
                    'text-emerald-400'
                  }`}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Role notice */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <ShieldCheck className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
              <p className="text-slate-400 text-xs leading-relaxed">
                New accounts start with <span className="text-slate-300 font-semibold">read-only Auditor access</span>.
                An existing Admin can grant additional permissions from Users &amp; Roles.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="signup-submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-2 bg-[#482F1E] hover:bg-[#5A3D28] active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#482F1E]/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-5 sm:mt-7 pt-5 sm:pt-6 border-t border-slate-800/50">
            <span className="text-slate-600 text-xs">Already have an account? </span>
            <Link
              to="/login"
              className="text-amber-400/80 hover:text-amber-300 text-xs font-bold transition-colors duration-200"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
