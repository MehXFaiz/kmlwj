import React, { useState, useEffect } from 'react';
import { useCoaStore } from '../store/coaStore';
import { useJournalStore } from '../store/journalStore';
import { useAuthStore } from '../store/authStore';
import { useConfirmStore } from '../store/confirmStore';
import { showToast } from '../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Settings as SettingsIcon, RotateCcw, ShieldCheck, Database, HardDrive, RefreshCw, Lock, Loader2 } from 'lucide-react';
import api from '../services/api';
import { syncEngine } from '../services/syncEngine';

export const Settings = () => {
  const { resetAccounts } = useCoaStore();
  const { resetJournals, logActivity } = useJournalStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auth Store hooks for Change Password
  const { changePassword, loading: authLoading, error: authError, successMessage: authSuccess, clearError: clearAuthError, clearSuccess: clearAuthSuccess } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    clearAuthError();
    clearAuthSuccess();
  }, []);

  const handleResetSandbox = async () => {
    const confirmed = await useConfirmStore.getState().showConfirm({
      type: 'danger',
      isDangerous: true,
      title: 'Reset Financial System?',
      description: 'This will remove all dummy financial data from the entire accounting system while keeping Chart of Accounts, Users, Roles, Donors, Members, and Master Data intact.',
      details: [
        'All Donations, Incomes, Expenses, Invoices, and Journal Entries will be deleted.',
        'All Cash In Hand and Bank account balances will be set to Rs 0.00.',
        'All General Ledger transactions and ledger balances will be cleared.',
        'Dashboard cards, charts, and reports will immediately reflect zero.',
        'This action cannot be undone.',
      ],
      confirmLabel: 'Reset Financial System',
      cancelLabel: 'Cancel',
      loadingLabel: 'Resetting Financial System...',
      action: async () => {
        try {
          await api.post('/api/v1/system-reset');
          resetAccounts();
          resetJournals();
          syncEngine.triggerLocalSync();
          showToast('System financial data has been successfully reset.\n\nAll calculations are now starting from zero.\n\nMaster data has been preserved.', 'success');
        } catch (err) {
          const msg = err.response?.data?.error?.message || 'Failed to reset financial data';
          showToast(msg, 'error');
          throw err;
        }
      },
    });

    if (confirmed) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    clearAuthError();
    clearAuthSuccess();

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must include an uppercase letter, a lowercase letter, and a digit');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const ok = await changePassword(oldPassword, newPassword);
    if (ok) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">System Settings</h2>
        <p className="text-xs text-slate-400">Configure global configurations, system variables, database controls, and local storage caches.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Columns */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Change Password Card */}
          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-brand-400" />
                <CardTitle>Change Security Password</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Update your login credentials. Modifying your password will revoke all other active sessions for security.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {passwordError && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-semibold leading-relaxed">
                  {passwordError}
                </div>
              )}
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-semibold leading-relaxed">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-semibold leading-relaxed">
                  {authSuccess}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    pattern="^.{8,}$"
                    title="Password must be at least 8 characters long."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">New Password (Min 8 chars, upper + lower + digit)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$"
                    title="Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a digit."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$"
                    title="Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a digit."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 text-sm transition-all font-medium"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={authLoading}
                  className="gap-1.5 cursor-pointer"
                  size="sm"
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Update Password</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sandbox controls */}
          <Card>
            <CardHeader className="border-b border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-brand-400" />
                <CardTitle>System Database Administration</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Perform administrative tasks, manage browser-persisted localStorage caches, and clear test accounts.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Reset Control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-850">
                <div className="space-y-1 max-w-lg">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Reset Trial Sandbox
                  </h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Revert all database records to seed accounts (founder capital contribution, pre-configured parent-child current assets, cost templates).
                  </p>
                </div>
                
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleResetSandbox}
                  disabled={loading}
                  className="gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>{success ? 'Ledger Reset Complete' : 'Reset Sandbox'}</span>
                </Button>
              </div>

              {/* Cache Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 flex items-start gap-3">
                  <HardDrive className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Persistence Engine</span>
                    <span className="block text-xs font-semibold text-slate-200 mt-1">HTML5 LocalStorage</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Encryption Mode</span>
                    <span className="block text-xs font-semibold text-slate-200 mt-1">None (Plain sandbox cache)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informative column */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-brand-400" />
                <CardTitle>System Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs leading-relaxed text-slate-400">
              <div>
                <span className="block font-bold text-[10px] text-slate-500 uppercase">Software Version</span>
                <span className="block font-medium text-slate-300 mt-0.5">AccuLedger ERP v1.0.0-rc1</span>
              </div>
              
              <div>
                <span className="block font-bold text-[10px] text-slate-500 uppercase">Database Engine</span>
                <span className="block font-medium text-slate-300 mt-0.5">PostgreSQL + Prisma ORM</span>
              </div>
              
              <div className="border-t border-slate-800 pt-4">
                <h5 className="font-bold text-[10px] text-slate-300 uppercase tracking-wide mb-1">compliance details</h5>
                <p>
                  This frontend layout is customized to reflect modern enterprise cloud ERP interfaces. Accounts schema matches GAAP standards. Double-entry calculations balance balances using DFS parent nodes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
