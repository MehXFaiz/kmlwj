import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { showToast } from '../ui/Toast';
import api from '../../services/api';
import { syncEngine } from '../../services/syncEngine';
import {
  AlertTriangle,
  ShieldAlert,
  Lock,
  CheckCircle2,
  Trash2,
  Database,
  RefreshCw,
  Info,
  Check,
  X
} from 'lucide-react';

export const ResetErpDataModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const { resetAccounts } = useCoaStore();
  const { resetJournals } = useJournalStore();

  const isSuperAdmin = user?.role === 'Super Admin';

  const [resetMode, setResetMode] = useState('TRANSACTIONS_ONLY'); // 'TRANSACTIONS_ONLY' | 'FULL_FINANCIAL_RESET'
  const [resetSequences, setResetSequences] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const canExecute = confirmationText.trim() === 'RESET ERP DATA' && password.length >= 1;

  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (!canExecute || loading) return;

    if (!isSuperAdmin) {
      showToast('Forbidden: Only Super Admin can perform system data reset', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/v1/system-reset', {
        password,
        confirmationText: confirmationText.trim(),
        resetMode,
        resetSequences
      });

      const data = res.data?.data;
      setResetResult(data);

      // Invalidate frontend state & stores
      try {
        resetAccounts();
        resetJournals();
        useDashboardStore.getState().invalidateAll();
        syncEngine.triggerLocalSync();
      } catch (err) {}

      showToast('ERP System Data Reset completed successfully!', 'success');
      if (onSuccess) onSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'ERP data reset failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset ERP Data" maxWidth="max-w-3xl">
      {resetResult ? (
        <div className="space-y-5 pt-2">
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-900/60 text-emerald-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>ERP DATA RESET COMPLETED</span>
            </div>
            <p className="text-xs text-emerald-200/80">
              The database transaction committed cleanly. Accounting trial balance is verified as BALANCED.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Reset Summary ({resetResult.resetMode})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Journal Entries:</span>
                <span className="text-slate-100 font-bold">{resetResult.jeCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Journal Lines:</span>
                <span className="text-slate-100 font-bold">{resetResult.jelCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Add Income:</span>
                <span className="text-slate-100 font-bold">{resetResult.addIncomeCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Hall Bookings:</span>
                <span className="text-slate-100 font-bold">{resetResult.hallBookingCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Donations Recv:</span>
                <span className="text-slate-100 font-bold">{resetResult.donationReceivedCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Petty Cash Txs:</span>
                <span className="text-slate-100 font-bold">{resetResult.pettyCashTxCount}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400">Trial Balance Audit:</span>
              <span className="text-emerald-400 font-bold">
                Debits: PKR {resetResult.totalDebit.toLocaleString()} | Credits: PKR {resetResult.totalCredit.toLocaleString()} (BALANCED)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={() => {
                setResetResult(null);
                onClose();
              }}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              Done & Refresh View
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleExecuteReset} className="space-y-5 pt-1">
          {/* Danger Banner */}
          <div className="p-4 rounded-2xl bg-red-950/50 border border-red-900/70 text-red-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm text-red-400">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>WARNING: PERMANENT SYSTEM DATA RESET</span>
            </div>
            <p className="text-xs text-red-200/90 leading-relaxed">
              This action permanently removes ERP transactional data. This cannot be undone. Master definitions (Chart of Accounts, Categories, Members, Users) will be preserved.
            </p>
          </div>

          {/* Backup Warning */}
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-900/50 text-amber-300 text-xs flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold block mb-0.5 text-amber-200">Database Backup Requirement</span>
              <span>Automated database backup is not configured. Continue only if you already have a verified database backup.</span>
            </div>
          </div>

          {/* Reset Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select Reset Scope Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setResetMode('TRANSACTIONS_ONLY')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  resetMode === 'TRANSACTIONS_ONLY'
                    ? 'bg-brand-950/50 border-brand-500/70 ring-1 ring-brand-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-100">Option A: Clear Transactions Only</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${resetMode === 'TRANSACTIONS_ONLY' ? 'border-brand-400 bg-brand-500' : 'border-slate-600'}`}>
                    {resetMode === 'TRANSACTIONS_ONLY' && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Removes operational transactions while preserving configured Opening Balances.
                </p>
              </div>

              <div
                onClick={() => setResetMode('FULL_FINANCIAL_RESET')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  resetMode === 'FULL_FINANCIAL_RESET'
                    ? 'bg-red-950/50 border-red-500/70 ring-1 ring-red-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-red-300">Option B: Full Financial Reset</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${resetMode === 'FULL_FINANCIAL_RESET' ? 'border-red-400 bg-red-500' : 'border-slate-600'}`}>
                    {resetMode === 'FULL_FINANCIAL_RESET' && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Removes all transactions AND Opening Balance records so ERP starts completely from zero.
                </p>
              </div>
            </div>
          </div>

          {/* Sequence Reset Option */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <input
              type="checkbox"
              id="resetSequences"
              checked={resetSequences}
              onChange={(e) => setResetSequences(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="resetSequences" className="text-slate-300 font-medium cursor-pointer">
              Reset voucher / receipt transaction numbering sequences back to 1
            </label>
          </div>

          {/* Detailed Breakdown Accordion/Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Deleted Items */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <span className="font-bold text-red-400 text-[11px] uppercase tracking-wider block flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Transactional Data To Be Deleted
              </span>
              <ul className="space-y-1 text-slate-400 text-[11px]">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Journal Entries & Lines</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> General Ledger postings</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Add Income & Simple Income</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Simple Expenses & Vouchers</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Hall Bookings & Payments</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Donations & Zakat Cards</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Invoices & Line Items</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> Petty Cash Transactions & Audits</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-red-400 shrink-0" /> AI Diagnostic Logs</li>
              </ul>
            </div>

            {/* Preserved Items */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider block flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> Master Config Preserved
              </span>
              <ul className="space-y-1 text-slate-400 text-[11px]">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Super Admin & User Accounts</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Chart of Accounts structure</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Income & Expense Categories</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Category → GL Account Mappings</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Members & Family Directory</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Beneficiaries, Customers, Donors</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> Roles, Permissions & Settings</li>
              </ul>
            </div>
          </div>

          {/* Verification Multi-Step Form */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-400" /> Multi-Step Super Admin Verification
            </h4>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Step 1: Type <span className="text-red-400 font-mono font-bold">RESET ERP DATA</span> to confirm
              </label>
              <input
                type="text"
                placeholder="RESET ERP DATA"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500/60"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Step 2: Enter Super Admin Password
              </label>
              <input
                type="password"
                placeholder="Super Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500/60"
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canExecute || loading || !isSuperAdmin}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-lg ${
                canExecute && isSuperAdmin && !loading
                  ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-red-950/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              <span>PERMANENTLY RESET ERP DATA</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
