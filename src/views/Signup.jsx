import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';

export const Signup = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading, error, successMessage, clearError, clearSuccess } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ACCOUNTANT');
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

    if (!email || !password || !name) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    const success = await register(email, password, name, role);
    if (success) {
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    }
  };

  return (
    <AuthLayout>
      <div className="relative group">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-600 to-emerald-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors mb-4">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </Link>
            <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-emerald-400">
              Request Access
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              Register an operator account in the ledger database
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
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">Password (Min 8 chars)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Access Role Selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 tracking-wider uppercase">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all cursor-pointer"
              >
                <option value="ACCOUNTANT">Accountant (Read/Write)</option>
                <option value="ADMIN">Administrator (Full Access)</option>
                <option value="VIEWER">Auditor / Viewer (Read Only)</option>
              </select>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-indigo-500 to-emerald-600 hover:from-indigo-400 hover:to-emerald-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Submit Application'
              )}
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
};
