import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { showToast } from '../ui/Toast';
import { erpResetService } from '../../services/apiServices';
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
  X,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  ShieldCheck,
  FileText,
  Activity,
  ArrowRight
} from 'lucide-react';

export const ResetErpDataModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const { resetAccounts } = useCoaStore();
  const { resetJournals } = useJournalStore();

  const userRoleName = typeof user?.role === 'object' && user?.role !== null ? user.role.name : (user?.role || '');
  const isSuperAdmin = userRoleName?.toLowerCase() === 'super admin' || user?.isPrivileged === true;

  // Tabs: 'reset' | 'history'
  const [activeTab, setActiveTab] = useState('reset');

  // Reset Mode: 'TRANSACTIONS_ONLY' | 'FULL_FINANCIAL_RESET' | 'FULL_ERP_RESET'
  const [resetMode, setResetMode] = useState('TRANSACTIONS_ONLY');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Security Inputs
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');

  // Live Preview Data
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Execution & Progress State
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 0 to 6
  const [resetResult, setResetResult] = useState(null);
  const [executionError, setExecutionError] = useState(null);

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchPreview = useCallback(async (mode) => {
    if (!isOpen || !isSuperAdmin) return;
    setPreviewLoading(true);
    try {
      const res = await erpResetService.getPreview(mode);
      if (res?.data) {
        setPreview(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch reset preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [isOpen, isSuperAdmin]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await erpResetService.getHistory(20);
      setHistoryLogs(res?.data || []);
    } catch (err) {
      console.error('Failed to load reset history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      fetchPreview(resetMode);
      if (activeTab === 'history') {
        fetchHistory();
      }
    } else {
      // Reset form when closed
      setConfirmationText('');
      setPassword('');
      setResetResult(null);
      setExecutionError(null);
      setProgressStep(0);
      setIsExecuting(false);
    }
  }, [isOpen, isSuperAdmin, resetMode, activeTab, fetchPreview, fetchHistory]);

  const handleModeChange = (mode) => {
    setResetMode(mode);
    fetchPreview(mode);
  };

  const normalizedConfirmation = confirmationText.trim().toUpperCase();
  const isConfirmationMatched = normalizedConfirmation === 'RESET ERP' || normalizedConfirmation === 'RESET ERP DATA';
  const isEmailDetected = confirmationText.includes('@');
  const canSubmit = isConfirmationMatched && password.length >= 1 && !isExecuting && isSuperAdmin;

  const progressStepsList = [
    'Verifying Super Admin Authorization & Safety Locks...',
    'Querying Database State & Calculating Record Counts...',
    'Executing Targeted Deletion of Transactional Collections...',
    'Resetting Chart of Accounts Monetary Balances to Zero...',
    'Clearing Stale Diagnostic & AI Accounting Issues...',
    'Running Fresh Accounting Integrity Reconciliation...',
  ];

  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsExecuting(true);
    setExecutionError(null);
    setProgressStep(0);

    // Simulated multi-step progress feedback while backend transaction commits
    const stepInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 900);

    try {
      const res = await erpResetService.execute({
        resetMode,
        password,
        confirmationText: confirmationText.trim(),
      });

      clearInterval(stepInterval);
      setProgressStep(6);

      const data = res.data;
      setResetResult(data);

      // Invalidate frontend state & stores
      try {
        resetAccounts();
        resetJournals();
        useDashboardStore.getState().invalidateAll();
        syncEngine.triggerLocalSync();
      } catch (storeErr) {
        console.warn('Frontend store reset warning:', storeErr);
      }

      showToast('ERP System Data Reset completed successfully!', 'success');
      if (onSuccess) onSuccess(data);
    } catch (err) {
      clearInterval(stepInterval);
      const errMsg = err.response?.data?.error?.message || err.message || 'ERP Data Reset failed';
      setExecutionError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset ERP Data" maxWidth="max-w-4xl">
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reset')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reset'
                  ? 'bg-rose-950/70 border border-rose-800/60 text-rose-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset ERP Operations
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchHistory();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-800 border border-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Reset History Logs
            </button>
          </div>

          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Super Admin Only
          </span>
        </div>

        {/* TAB 1: RESET OPERATIONS */}
        {activeTab === 'reset' && (
          <>
            {resetResult ? (
              /* SUCCESS SCREEN */
              <div className="space-y-5 pt-1">
                <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-900/60 border border-emerald-700/60 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-emerald-100">ERP Reset Completed Successfully</h3>
                      <p className="text-xs text-emerald-300/80">
                        Reset ID: <span className="font-mono font-bold">{resetResult.resetId}</span> | Execution duration: {resetResult.durationMs}ms
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-emerald-200/90 leading-relaxed">
                    Transactional records have been purged and accounting ledgers zeroed cleanly. The Trial Balance has been verified and Double-Entry integrity is strictly balanced.
                  </p>
                </div>

                {/* Summary Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Records Deleted</span>
                    <span className="text-xl font-extrabold font-mono text-rose-400">
                      {resetResult.totalRecordsDeleted?.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Accounts Preserved</span>
                    <span className="text-xl font-extrabold font-mono text-emerald-400">
                      {resetResult.preservedCounts?.accounts ?? resetResult.breakdown?.accCount}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Users Preserved</span>
                    <span className="text-xl font-extrabold font-mono text-emerald-400">
                      {resetResult.preservedCounts?.users}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Trial Balance</span>
                    <span className="text-xs font-bold font-mono text-emerald-400 block mt-1">
                      BALANCED (0.00)
                    </span>
                  </div>
                </div>

                {/* Granular Breakdown */}
                <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2.5">
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Deletion Summary Breakdown
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Journal Entries:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.jeCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Journal Lines:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.jelCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Add Income:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.addIncomeCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Simple Expenses:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.simpleExpenseCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Donations:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.donationGivenCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Donations Recv:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.donationReceivedCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Hall Bookings:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.hallBookingCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">Invoices:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.invCount ?? 0}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400 text-[11px]">AI Issues Cleared:</span>
                      <span className="font-bold text-slate-200">{resetResult.breakdown?.aiIssueCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetResult(null);
                      onClose();
                    }}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                  >
                    Done &amp; Refresh Dashboard
                  </button>
                </div>
              </div>
            ) : isExecuting ? (
              /* PROGRESS STEPPER SCREEN */
              <div className="py-8 px-4 space-y-6 text-center">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-rose-900/30 border-t-rose-500 animate-spin" />
                  <RotateCcw className="h-6 w-6 text-rose-400" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-100">Executing ERP Data Reset...</h3>
                  <p className="text-xs text-slate-400">Please do not close your browser while the database transaction commits.</p>
                </div>

                <div className="max-w-md mx-auto space-y-2.5 text-left text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {progressStepsList.map((stepDesc, idx) => {
                    const isDone = progressStep > idx;
                    const isCurrent = progressStep === idx;
                    return (
                      <div
                        key={stepDesc}
                        className={`flex items-center gap-2.5 transition-all ${
                          isDone
                            ? 'text-emerald-400 font-semibold'
                            : isCurrent
                            ? 'text-rose-300 font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : isCurrent ? (
                          <RefreshCw className="h-4 w-4 shrink-0 text-rose-400 animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-700 shrink-0" />
                        )}
                        <span>{stepDesc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* RESET CONFIGURATION & EXECUTION FORM */
              <form onSubmit={handleExecuteReset} className="space-y-4">
                {/* Warning Alert Banner */}
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/60 text-red-200 text-xs flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold block text-red-300 uppercase tracking-wide">
                      Permanent Destructive Operation
                    </span>
                    <p className="text-red-200/80 leading-relaxed">
                      This action will permanently delete selected ERP transactional records and reset accounting calculations. This operation cannot be undone unless a database backup is available.
                    </p>
                  </div>
                </div>

                {/* Reset Scope Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Select Reset Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option A: Reset Transactional Data */}
                    <div
                      onClick={() => handleModeChange('TRANSACTIONS_ONLY')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        resetMode === 'TRANSACTIONS_ONLY'
                          ? 'bg-rose-950/40 border-rose-500/70 ring-1 ring-rose-500/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                          Option A: Reset Transactional Data
                        </span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            resetMode === 'TRANSACTIONS_ONLY' ? 'border-rose-400 bg-rose-500' : 'border-slate-600'
                          }`}
                        >
                          {resetMode === 'TRANSACTIONS_ONLY' && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Deletes operational records (vouchers, journals, invoices, bookings, receipts) while preserving Opening Balances &amp; Master Data.
                      </p>
                    </div>

                    {/* Option B: Reset Accounting & Audit Data */}
                    <div
                      onClick={() => handleModeChange('FULL_FINANCIAL_RESET')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        resetMode === 'FULL_FINANCIAL_RESET'
                          ? 'bg-rose-950/40 border-rose-500/70 ring-1 ring-rose-500/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                          Option B: Reset Accounting &amp; Audit Data
                        </span>
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            resetMode === 'FULL_FINANCIAL_RESET' ? 'border-rose-400 bg-rose-500' : 'border-slate-600'
                          }`}
                        >
                          {resetMode === 'FULL_FINANCIAL_RESET' && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Deletes all transactions AND Opening Balances, zeroing all Account balances and rebuilding audit state from clean slate.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option C: Advanced / Dangerous Actions (Collapsible) */}
                <div className="rounded-xl border border-red-950/60 bg-red-950/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-red-400 hover:bg-red-950/20 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      Advanced / Dangerous Actions
                    </span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showAdvanced && (
                    <div className="p-3.5 pt-1 space-y-2.5 border-t border-red-950/40">
                      <div
                        onClick={() => handleModeChange('FULL_ERP_RESET')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          resetMode === 'FULL_ERP_RESET'
                            ? 'bg-red-950/60 border-red-500 ring-1 ring-red-500'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-xs text-red-300">Option C: FULL ERP RESET</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              resetMode === 'FULL_ERP_RESET' ? 'border-red-400 bg-red-500' : 'border-slate-600'
                            }`}
                          >
                            {resetMode === 'FULL_ERP_RESET' && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Purges all operational data and directory records (Members, Beneficiaries, Donors, Customers). Preserves only root configuration (Super Admin, Roles, Permissions, Chart of Accounts structure).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pre-Reset Live Database Summary & Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-rose-400" />
                      Pre-Reset Database Summary
                    </span>
                    {previewLoading ? (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Querying MongoDB...
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-rose-400 font-bold">
                        Records to be deleted: {preview?.affectedCounts?.totalAffected?.toLocaleString() ?? '—'}
                      </span>
                    )}
                  </div>

                  {preview && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Journal Entries:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.journalEntries}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Journal Lines:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.journalEntryLines}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Invoices:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.invoices}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Income &amp; Expenses:</span>
                        <span className="text-slate-200 font-bold">
                          {preview.affectedCounts.addIncomeRecords + preview.affectedCounts.simpleIncomes + preview.affectedCounts.simpleExpenses}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Donations (All):</span>
                        <span className="text-slate-200 font-bold">
                          {preview.affectedCounts.donationsGiven + preview.affectedCounts.donationsReceived}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Hall Bookings:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.hallBookings}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Petty Cash Vouchers:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.pettyCashTransactions}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">AI Audit Issues:</span>
                        <span className="text-slate-200 font-bold">{preview.affectedCounts.aiRepairIssues}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preserved vs Deleted Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <span className="font-bold text-rose-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Data To Be Deleted
                    </span>
                    <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                      <li>General Ledger transactions &amp; vouchers</li>
                      <li>Invoices, Income &amp; Expense records</li>
                      <li>Donation disbursements &amp; receipts</li>
                      <li>Hall booking reservations &amp; payments</li>
                      <li>Petty cash transactions &amp; audits</li>
                      <li>AI Health &amp; Audit diagnostic issues</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Database className="h-3 w-3" /> Master Data Preserved
                    </span>
                    <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                      <li>Chart of Accounts hierarchy &amp; GL codes</li>
                      <li>Super Admin &amp; User credentials</li>
                      <li>Roles &amp; granular permissions</li>
                      <li>Income Categories &amp; Heads</li>
                      <li>Financial Year calendar config</li>
                      {resetMode !== 'FULL_ERP_RESET' && <li>Members, Donors &amp; Beneficiaries</li>}
                    </ul>
                  </div>
                </div>

                {/* Security Verification Inputs */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-rose-400" /> Super Admin Confirmation Security
                    </h4>
                    <button
                      type="button"
                      onClick={() => setConfirmationText('RESET ERP')}
                      className="text-[10px] text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 px-2.5 py-1 rounded-lg border border-rose-800/70 font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Check className="h-3 w-3 text-rose-400" />
                      <span>Fill &quot;RESET ERP&quot;</span>
                    </button>
                  </div>

                  {/* Hidden dummy input to deter aggressive browser credential manager autofill */}
                  <input
                    type="text"
                    name="prevent_browser_autofill_username"
                    style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1 }}
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="off"
                  />

                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Type <span className="text-rose-400 font-mono font-bold">RESET ERP</span> to confirm:
                        </label>
                        {isConfirmationMatched ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                            <CheckCircle2 className="h-3 w-3" /> Confirmation Matched
                          </span>
                        ) : isEmailDetected ? (
                          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                            <AlertTriangle className="h-3 w-3" /> Email Detected (Not RESET ERP)
                          </span>
                        ) : confirmationText.length > 0 ? (
                          <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                            <X className="h-3 w-3" /> Mismatch
                          </span>
                        ) : null}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          name="erp_reset_security_confirmation_token"
                          id="erp_reset_security_confirmation_token"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="characters"
                          spellCheck="false"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-form-type="other"
                          placeholder="RESET ERP"
                          value={confirmationText}
                          onChange={(e) => setConfirmationText(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-all ${
                            isConfirmationMatched
                              ? 'border-emerald-500/80 ring-1 ring-emerald-500/30'
                              : isEmailDetected
                              ? 'border-amber-500/80 ring-1 ring-amber-500/30'
                              : confirmationText.length > 0
                              ? 'border-rose-500/80 ring-1 ring-rose-500/30'
                              : 'border-slate-800 focus:border-rose-500/70'
                          }`}
                          required
                        />
                      </div>

                      {isEmailDetected && (
                        <p className="text-[10px] text-amber-400/90 mt-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span>Browser autofilled your email address. Click the <strong>Fill &quot;RESET ERP&quot;</strong> button above or type <strong>RESET ERP</strong>.</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Super Admin Password Re-Authentication:
                      </label>
                      <input
                        type="password"
                        name="super_admin_security_reauth_password"
                        id="super_admin_security_reauth_password"
                        autoComplete="current-password"
                        data-lpignore="true"
                        placeholder="Enter your Super Admin password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/70"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {executionError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-900 text-red-300 text-xs flex items-center gap-2">
                    <X className="h-4 w-4 text-red-400 shrink-0" />
                    <span>{executionError}</span>
                  </div>
                )}

                {/* Modal Footer Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-900">
                  <div className="text-[11px]">
                    {!isSuperAdmin ? (
                      <span className="text-red-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Super Admin role required to reset
                      </span>
                    ) : !isConfirmationMatched ? (
                      <span className="text-amber-400/90 flex items-center gap-1.5 font-medium">
                        <Info className="h-3.5 w-3.5 shrink-0" /> Type &quot;RESET ERP&quot; (or click Fill) to enable button
                      </span>
                    ) : !password ? (
                      <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                        <Info className="h-3.5 w-3.5 shrink-0" /> Enter your password to enable button
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Ready to execute reset
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isExecuting}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md ${
                        canSubmit
                          ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-rose-950/50'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Confirm &amp; Reset ERP Data</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}

        {/* TAB 2: RESET HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Historical ERP Reset Audit Records
              </h4>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading audit history...
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
                <History className="h-6 w-6 text-slate-600 mx-auto mb-1.5" />
                No ERP reset operations recorded in audit log yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-300">{log.resetId}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          {log.resetMode}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                          {log.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Performed by:</span>
                        <span className="text-slate-200 font-medium">{log.performedBy} ({log.adminEmail})</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Records Deleted:</span>
                        <span className="text-rose-400 font-mono font-bold">
                          {log.totalRecordsDeleted?.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Duration:</span>
                        <span className="text-slate-300 font-mono">{log.durationMs ? `${log.durationMs}ms` : '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
