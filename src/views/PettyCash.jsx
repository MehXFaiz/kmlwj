import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  PlusCircle, 
  MinusCircle, 
  FileText, 
  ShieldCheck, 
  Sliders, 
  Printer, 
  RotateCcw, 
  AlertCircle, 
  Search, 
  Calendar, 
  CheckCircle2, 
  X,
  History,
  Coins,
  Building,
  TrendingDown,
  TrendingUp,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { usePettyCashStore } from '../store/pettyCashStore';
import { useCoaStore } from '../store/coaStore';
import { PettyCashVoucherModal } from '../components/common/PettyCashVoucherModal';

export const PettyCash = () => {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const {
    config,
    register,
    reconciliations,
    loading,
    error,
    fetchConfig,
    fetchRegister,
    fetchReconciliations,
    addCash,
    recordExpense,
    replenish,
    updateConfig,
    reconcile,
    approveReconciliation,
    revertTransaction
  } = usePettyCashStore();

  const { accounts, loading: loadingCoa, fetchAccounts } = useCoaStore();

  // Active View Tab: 'OPERATIONS' | 'PHYSICAL_COUNT' | 'AUDIT_REGISTER' | 'SETTINGS'
  const [activeTab, setActiveTab] = useState('OPERATIONS');

  // Selected Voucher for Slip Modal Printing
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);

  // Form States
  const [addCashForm, setAddCashForm] = useState({
    sourceAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    narration: ''
  });

  const [replenishForm, setReplenishForm] = useState({
    sourceAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    narration: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    expenseAccountId: '',
    amount: '',
    paidTo: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    narration: ''
  });

  const [countForm, setCountForm] = useState({
    physicalCount: '',
    date: new Date().toISOString().split('T')[0],
    explanation: ''
  });

  const [configForm, setConfigForm] = useState({
    fundLimit: '',
    custodianName: ''
  });

  const [revertTxId, setRevertTxId] = useState(null);
  const [revertReason, setRevertReason] = useState('');

  // Register Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchRegister();
    fetchReconciliations();
    fetchAccounts();
  }, [fetchConfig, fetchRegister, fetchReconciliations, fetchAccounts]);

  useEffect(() => {
    if (config) {
      setConfigForm({
        fundLimit: config.fundLimit || 50000,
        custodianName: config.custodianName || 'Authorized Custodian'
      });
      setCountForm(prev => ({
        ...prev,
        physicalCount: config.physicalCount !== undefined ? config.physicalCount : config.currentBalance
      }));
    }
  }, [config]);

  const handleRefresh = useCallback(() => {
    fetchConfig();
    fetchRegister();
    fetchReconciliations();
    fetchAccounts();
    showToast('Petty Cash records updated from database', 'info');
  }, [fetchConfig, fetchRegister, fetchReconciliations, fetchAccounts]);

  // Cash & Bank Accounts (Asset) - excluding Petty Cash itself to prevent self-transfers
  const cashBankAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (a.isLocked || a.status === 'Inactive') return false;
      if (config?.accountId && a.id === config.accountId) return false;

      const isGlLevel = (a.level || a.accountLevel) === 'GL';
      if (!isGlLevel) return false;

      const typeStr = (a.type || a.accountType?.name || '').toLowerCase();
      if (typeStr !== 'asset') return false;

      const nameStr = (a.name || a.accountName || '').toLowerCase();
      if (nameStr.includes('petty cash')) return false;

      const detailStr = (a.detailType || '').toLowerCase();
      const isCashOrBank =
        detailStr === 'cash' ||
        detailStr === 'bank' ||
        nameStr.includes('bank') ||
        nameStr.includes('cash') ||
        nameStr.includes('till') ||
        nameStr.includes('hand');

      return isCashOrBank;
    });
  }, [accounts, config?.accountId]);

  // Expense Accounts
  const expenseAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (a.isLocked || a.status === 'Inactive') return false;

      const isGlLevel = (a.level || a.accountLevel) === 'GL';
      if (!isGlLevel) return false;

      const typeStr = (a.type || a.accountType?.name || '').toLowerCase();
      return typeStr === 'expense';
    });
  }, [accounts]);

  // Filtered Register Rows
  const filteredRegister = useMemo(() => {
    return register.filter(row => {
      const matchesSearch = 
        row.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.paidTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.expenseCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.createdBy && row.createdBy.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = !typeFilter || row.transactionType === typeFilter;
      const matchesStart = !startDateFilter || row.date >= startDateFilter;
      const matchesEnd = !endDateFilter || row.date <= endDateFilter;

      return matchesSearch && matchesType && matchesStart && matchesEnd;
    });
  }, [register, searchTerm, typeFilter, startDateFilter, endDateFilter]);

  // Dynamic Physical Count Difference Calculation
  const currentSysBalance = Number(config?.currentBalance || 0);
  const physicalInputVal = countForm.physicalCount !== '' ? Number(countForm.physicalCount) : currentSysBalance;
  const countDifference = physicalInputVal - currentSysBalance;

  // Handlers for Inline Submissions
  const handleAddCashSubmit = async (e) => {
    e.preventDefault();

    const amt = parseFloat(addCashForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Transfer amount must be a positive number greater than 0.', 'error');
      return;
    }

    if (!addCashForm.sourceAccountId) {
      showToast('Please select a valid source Cash or Bank account.', 'error');
      return;
    }

    const sourceAcc = cashBankAccounts.find(a => a.id === addCashForm.sourceAccountId);
    if (sourceAcc && amt > Number(sourceAcc.currentBalance || 0)) {
      showToast(`Insufficient balance in selected account (${sourceAcc.name || sourceAcc.accountName}). Available: PKR ${Number(sourceAcc.currentBalance || 0).toLocaleString()}, Requested: PKR ${amt.toLocaleString()}`, 'error');
      return;
    }

    const availableCapacity = (config?.fundLimit || 50000) - (config?.currentBalance || 0);
    if (amt > availableCapacity) {
      showToast(`Transfer amount (PKR ${amt.toLocaleString()}) exceeds available Petty Cash fund capacity (PKR ${Math.max(0, availableCapacity).toLocaleString()}).`, 'error');
      return;
    }

    try {
      await addCash({
        sourceAccountId: addCashForm.sourceAccountId,
        amount: amt,
        date: addCashForm.date,
        referenceNo: addCashForm.referenceNo,
        narration: addCashForm.narration || 'Add Cash to Petty Cash Fund'
      });
      showToast('Cash transferred to Petty Cash successfully!', 'success');
      setAddCashForm({
        sourceAccountId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        referenceNo: '',
        narration: ''
      });
    } catch (err) {
      showToast(err.message || 'Failed to transfer cash to Petty Cash', 'error');
    }
  };

  const handleReplenishSubmit = async (e) => {
    e.preventDefault();

    const amt = parseFloat(replenishForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Replenishment amount must be a positive number greater than 0.', 'error');
      return;
    }

    if (!replenishForm.sourceAccountId) {
      showToast('Please select a valid replenishing Bank or Cash account.', 'error');
      return;
    }

    const sourceAcc = cashBankAccounts.find(a => a.id === replenishForm.sourceAccountId);
    if (sourceAcc && amt > Number(sourceAcc.currentBalance || 0)) {
      showToast(`Insufficient balance in selected account (${sourceAcc.name || sourceAcc.accountName}). Available: PKR ${Number(sourceAcc.currentBalance || 0).toLocaleString()}, Requested: PKR ${amt.toLocaleString()}`, 'error');
      return;
    }

    const availableCapacity = (config?.fundLimit || 50000) - (config?.currentBalance || 0);
    if (amt > availableCapacity) {
      showToast(`Replenishment amount (PKR ${amt.toLocaleString()}) exceeds available Petty Cash fund capacity (PKR ${Math.max(0, availableCapacity).toLocaleString()}).`, 'error');
      return;
    }

    try {
      await replenish({
        sourceAccountId: replenishForm.sourceAccountId,
        amount: amt,
        date: replenishForm.date,
        referenceNo: replenishForm.referenceNo,
        narration: replenishForm.narration || 'Petty Cash Fund Replenishment'
      });
      showToast('Petty Cash fund replenished successfully!', 'success');
      setReplenishForm({
        sourceAccountId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        referenceNo: '',
        narration: ''
      });
    } catch (err) {
      showToast(err.message || 'Failed to replenish Petty Cash fund', 'error');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Expense amount must be a positive number greater than 0.', 'error');
      return;
    }

    const currentBal = Number(config?.currentBalance || 0);
    if (amt > currentBal) {
      const shortfall = amt - currentBal;
      showToast(`Insufficient Petty Cash Balance.\nAvailable: PKR ${currentBal.toLocaleString()}\nRequested: PKR ${amt.toLocaleString()}\nShortfall: PKR ${shortfall.toLocaleString()}`, 'error');
      return;
    }

    if (!expenseForm.expenseAccountId) {
      showToast('Please select an Expense category.', 'error');
      return;
    }

    if (!expenseForm.paidTo || !expenseForm.paidTo.trim()) {
      showToast('Recipient (Paid To) is required.', 'error');
      return;
    }

    try {
      await recordExpense({
        expenseAccountId: expenseForm.expenseAccountId,
        amount: amt,
        paidTo: expenseForm.paidTo.trim(),
        date: expenseForm.date,
        referenceNo: expenseForm.referenceNo,
        narration: expenseForm.narration
      });
      showToast('Petty Cash Expense recorded successfully!', 'success');
      setExpenseForm({
        expenseAccountId: '',
        amount: '',
        paidTo: '',
        date: new Date().toISOString().split('T')[0],
        referenceNo: '',
        narration: ''
      });
    } catch (err) {
      showToast(err.message || 'Failed to record Petty Cash expense', 'error');
    }
  };

  const handleCountSubmit = async (e) => {
    e.preventDefault();

    const countVal = parseFloat(countForm.physicalCount);
    if (isNaN(countVal) || countVal < 0) {
      showToast('Physical count must be a non-negative number.', 'error');
      return;
    }

    if (countDifference !== 0 && (!countForm.explanation || countForm.explanation.trim().length < 5)) {
      showToast('Variance explanation (minimum 5 characters) is required when physical count differs from system balance.', 'error');
      return;
    }

    try {
      await reconcile({
        physicalCount: countVal,
        explanation: countForm.explanation ? countForm.explanation.trim() : ''
      });
      showToast('Physical count saved and audited successfully!', 'success');
      fetchConfig();
      fetchReconciliations();
    } catch (err) {
      showToast(err.message || 'Failed to save physical count', 'error');
    }
  };

  const handleApproveReconciliation = async (reconciliationId) => {
    try {
      await approveReconciliation({ reconciliationId });
      showToast('Reconciliation adjustment approved and posted to General Ledger!', 'success');
      fetchConfig();
      fetchRegister();
      fetchReconciliations();
    } catch (err) {
      showToast(err.message || 'Failed to approve reconciliation', 'error');
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();

    const limitVal = parseFloat(configForm.fundLimit);
    if (isNaN(limitVal) || limitVal <= 0) {
      showToast('Fund limit must be a positive number greater than 0.', 'error');
      return;
    }

    const curBal = Number(config?.currentBalance || 0);
    if (limitVal < curBal) {
      showToast(`Fund limit (PKR ${limitVal.toLocaleString()}) cannot be set lower than current active Petty Cash balance (PKR ${curBal.toLocaleString()}).`, 'error');
      return;
    }

    if (!configForm.custodianName || !configForm.custodianName.trim()) {
      showToast('Custodian name cannot be empty.', 'error');
      return;
    }

    try {
      await updateConfig({
        fundLimit: limitVal,
        custodianName: configForm.custodianName.trim()
      });
      showToast('Petty Cash configuration updated!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update configuration', 'error');
    }
  };

  const handleRevertSubmit = async (e) => {
    e.preventDefault();
    if (!revertTxId) return;

    if (!revertReason || !revertReason.trim()) {
      showToast('Reason for transaction reversal is required.', 'error');
      return;
    }

    try {
      await revertTransaction(revertTxId, revertReason.trim());
      showToast('Transaction reverted successfully!', 'success');
      setRevertTxId(null);
      setRevertReason('');
    } catch (err) {
      showToast(err.message || 'Failed to revert transaction', 'error');
    }
  };

  return (
    <DashboardLayout breadcrumbs={['Money Out', 'Petty Cash Module']}>
      <div className="space-y-6">
        
        {/* Toast Notification Banner */}
        {toast && (
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-lg text-xs font-bold ${
            toast.type === 'error' ? 'bg-rose-950/90 border-rose-800 text-rose-200' :
            toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' :
            'bg-blue-950/90 border-blue-800 text-blue-200'
          }`}>
            <div className="flex items-start gap-2 whitespace-pre-line">
              {toast.type === 'error' ? <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Header Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6 text-amber-400" />
              <span>Petty Cash Module</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Imprest Petty Cash Fund & Operational Disbursement Management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* SECTION 6: PETTY CASH SUMMARY CARDS (PERSISTED DATABASE VALUES) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* PETTY CASH BALANCE */}
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Petty Cash Balance</span>
            <p className="text-xl font-black font-mono text-amber-400">
              PKR {(config?.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">GL: {config?.glCode || '1010104'}</p>
          </div>

          {/* TOTAL CASH ADDED */}
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Cash Added</span>
            <p className="text-xl font-black font-mono text-emerald-400">
              PKR {(config?.totalAdded || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">Asset Transfers In</p>
          </div>

          {/* TOTAL EXPENSES */}
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Expenses</span>
            <p className="text-xl font-black font-mono text-rose-400">
              PKR {(config?.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">Operational Outflow</p>
          </div>

          {/* TOTAL REPLENISHED */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Total Replenished</span>
            <p className="text-xl font-black font-mono text-blue-400">
              PKR {(config?.totalReplenished || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">Bank Replenishments</p>
          </div>

          {/* PHYSICAL CASH */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Physical Cash</span>
            <p className="text-xl font-black font-mono text-slate-100">
              PKR {(config?.physicalCount !== undefined ? config.physicalCount : config?.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-500">Last Audit Count</p>
          </div>

          {/* DIFFERENCE */}
          <div className={`rounded-xl border p-4 space-y-1 ${
            (config?.difference || 0) < 0 ? 'bg-rose-950/30 border-rose-800/60' :
            (config?.difference || 0) > 0 ? 'bg-blue-950/30 border-blue-800/60' :
            'bg-slate-900/60 border-slate-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Difference</span>
            <p className={`text-xl font-black font-mono ${
              (config?.difference || 0) < 0 ? 'text-rose-400' :
              (config?.difference || 0) > 0 ? 'text-blue-400' :
              'text-emerald-400'
            }`}>
              PKR {(config?.difference || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
              (config?.difference || 0) < 0 ? 'bg-rose-950 text-rose-300 border border-rose-900' :
              (config?.difference || 0) > 0 ? 'bg-blue-950 text-blue-300 border border-blue-900' :
              'bg-emerald-950 text-emerald-300 border border-emerald-900'
            }`}>
              {(config?.difference || 0) < 0 ? 'Cash Shortage' : (config?.difference || 0) > 0 ? 'Cash Surplus' : 'Balanced'}
            </span>
          </div>

        </div>

        {/* INLINE PAGE NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('OPERATIONS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'OPERATIONS'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Petty Cash Operations</span>
          </button>

          <button
            onClick={() => setActiveTab('PHYSICAL_COUNT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'PHYSICAL_COUNT'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Physical Cash Count</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT_REGISTER')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'AUDIT_REGISTER'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Petty Cash Audit & Register</span>
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'SETTINGS'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Fund Settings</span>
          </button>
        </div>

        {/* TAB 1: PETTY CASH OPERATIONS (INLINE FORMS 1, 2, 3) */}
        {activeTab === 'OPERATIONS' && (
          <div className="space-y-6">
            
            {/* GRID OF INLINE OPERATIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* SECTION 1: ADD CASH TO PETTY CASH (INLINE FORM CARD) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <PlusCircle className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">Add Cash to Petty Cash</h2>
                    <p className="text-[11px] text-slate-400">Transfer liquidity from Cash in Hand or Bank into Petty Cash</p>
                  </div>
                </div>

                <form onSubmit={handleAddCashSubmit} className="space-y-3 text-xs">
                  {/* Row 1: Source Account & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Source Account (Cash or Bank) *</label>
                      <select
                        required
                        value={addCashForm.sourceAccountId}
                        onChange={(e) => setAddCashForm({ ...addCashForm, sourceAccountId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">
                          {loadingCoa ? 'Loading accounts...' : cashBankAccounts.length === 0 ? 'No eligible Cash/Bank accounts found' : 'Select Source Account'}
                        </option>
                        {cashBankAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name || a.accountName} — {a.code || a.glCode} — Available: PKR {Number(a.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Amount (PKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 10000"
                        value={addCashForm.amount}
                        onChange={(e) => setAddCashForm({ ...addCashForm, amount: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Date & Reference */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={addCashForm.date}
                        onChange={(e) => setAddCashForm({ ...addCashForm, date: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Reference / Cheque Number</label>
                      <input
                        type="text"
                        placeholder="Optional cheque / reference #"
                        value={addCashForm.referenceNo}
                        onChange={(e) => setAddCashForm({ ...addCashForm, referenceNo: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 3: Narration */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Narration / Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="Add Cash description for double-entry posting"
                      value={addCashForm.narration}
                      onChange={(e) => setAddCashForm({ ...addCashForm, narration: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Transfer to Petty Cash</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* SECTION 2: REPLENISH PETTY CASH FUND (INLINE FORM CARD) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ArrowDownLeft className="h-5 w-5 text-blue-400" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">Replenish Petty Cash Fund</h2>
                    <p className="text-[11px] text-slate-400">Replenish spent fund capacity back up to imprest ceiling</p>
                  </div>
                </div>

                <form onSubmit={handleReplenishSubmit} className="space-y-3 text-xs">
                  {/* Row 1: Replenishing Account & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Replenishing Bank/Cash Account *</label>
                      <select
                        required
                        value={replenishForm.sourceAccountId}
                        onChange={(e) => setReplenishForm({ ...replenishForm, sourceAccountId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">
                          {loadingCoa ? 'Loading accounts...' : cashBankAccounts.length === 0 ? 'No eligible Cash/Bank accounts found' : 'Select Bank / Cash Account'}
                        </option>
                        {cashBankAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name || a.accountName} — {a.code || a.glCode} — Available: PKR {Number(a.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Amount (PKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder={`Capacity space: PKR ${config?.availableCapacity || 0}`}
                        value={replenishForm.amount}
                        onChange={(e) => setReplenishForm({ ...replenishForm, amount: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Date & Reference */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={replenishForm.date}
                        onChange={(e) => setReplenishForm({ ...replenishForm, date: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Reference / Cheque Number</label>
                      <input
                        type="text"
                        placeholder="Optional cheque #"
                        value={replenishForm.referenceNo}
                        onChange={(e) => setReplenishForm({ ...replenishForm, referenceNo: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 3: Narration */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Narration / Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="Fund Replenishment description"
                      value={replenishForm.narration}
                      onChange={(e) => setReplenishForm({ ...replenishForm, narration: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      <span>Post Replenishment</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>

            {/* SECTION 3: RECORD PETTY CASH EXPENSE (DEDICATED FULL-WIDTH INLINE CARD) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MinusCircle className="h-5 w-5 text-rose-400" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">Record Petty Cash Expense</h2>
                    <p className="text-[11px] text-slate-400">Post operational expenses paid out of Petty Cash (DEBIT Expense, CREDIT Petty Cash)</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Petty Cash Available</span>
                  <p className="text-sm font-bold font-mono text-amber-400">
                    PKR {(config?.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
                {/* Row 1: Expense Category & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Expense Category *</label>
                    <select
                      required
                      value={expenseForm.expenseAccountId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expenseAccountId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">
                        {loadingCoa ? 'Loading accounts...' : expenseAccounts.length === 0 ? 'No eligible Expense accounts found' : 'Select Expense Category'}
                      </option>
                      {expenseAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name || a.accountName} — {a.code || a.glCode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Amount (PKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 1500"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Row 2: Date & Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Reference / Voucher Number</label>
                    <input
                      type="text"
                      placeholder="Optional receipt / ref #"
                      value={expenseForm.referenceNo}
                      onChange={(e) => setExpenseForm({ ...expenseForm, referenceNo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 3: Paid To & Narration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Paid To / Recipient</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Office Supply Mart / Driver"
                      value={expenseForm.paidTo}
                      onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Narration / Remarks</label>
                    <input
                      type="text"
                      placeholder="Operational expense details"
                      value={expenseForm.narration}
                      onChange={(e) => setExpenseForm({ ...expenseForm, narration: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <MinusCircle className="h-4 w-4" />
                    <span>Record Expense</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* TAB 2: PHYSICAL PETTY CASH COUNT (INLINE SECTION 4) */}
        {activeTab === 'PHYSICAL_COUNT' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Coins className="h-6 w-6 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-100">Physical Petty Cash Count</h2>
                  <p className="text-xs text-slate-400">Perform physical drawer count reconciliation against system GL balance</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
                Imprest Fund Audit
              </span>
            </div>

            <form onSubmit={handleCountSubmit} className="space-y-6 text-xs">
              
              {/* Calculations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">System Petty Cash Balance</span>
                  <p className="text-lg font-mono font-bold text-amber-400">
                    PKR {currentSysBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500">Authoritative GL Ledger Balance</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">Physical Cash Count *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter physical cash"
                    value={countForm.physicalCount}
                    onChange={(e) => setCountForm({ ...countForm, physicalCount: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-base text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500">Actual counted cash in till</p>
                </div>

                <div className={`p-4 rounded-xl border space-y-1 ${
                  countDifference < 0 ? 'bg-rose-950/40 border-rose-800 text-rose-300' :
                  countDifference > 0 ? 'bg-blue-950/40 border-blue-800 text-blue-300' :
                  'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                }`}>
                  <span className="text-[10px] font-bold uppercase">Calculated Difference</span>
                  <p className="text-lg font-mono font-bold">
                    PKR {countDifference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <span className="inline-block text-[10px] font-bold">
                    {countDifference < 0 ? 'Cash Shortage Detected' : countDifference > 0 ? 'Cash Surplus Detected' : 'All Cash Balanced'}
                  </span>
                </div>

              </div>

              {/* Status Banner Warning if Difference */}
              {countDifference !== 0 && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
                  countDifference < 0 ? 'bg-rose-950/50 border-rose-800/80 text-rose-200' : 'bg-blue-950/50 border-blue-800/80 text-blue-200'
                }`}>
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-bold">
                      {countDifference < 0 ? 'WARNING: Cash Shortage Detected' : 'NOTICE: Cash Surplus Detected'}
                    </span>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {countDifference < 0 
                        ? `Physical cash in hand is PKR ${Math.abs(countDifference).toLocaleString()} LESS than system records. Please enter variance explanation before saving.`
                        : `Physical cash in hand is PKR ${countDifference.toLocaleString()} MORE than system records.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Row 2: Date & Counted By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={countForm.date}
                    onChange={(e) => setCountForm({ ...countForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Counted By</label>
                  <input
                    type="text"
                    disabled
                    value={config?.custodianName || 'Authorized Custodian'}
                    className="w-full bg-slate-950/60 border border-slate-800/60 text-slate-400 rounded-xl p-2.5"
                  />
                </div>
              </div>

              {/* Row 3: Remarks / Explanation */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Remarks / Variance Explanation</label>
                <textarea
                  rows={3}
                  placeholder="Enter physical cash count notes or variance explanation..."
                  value={countForm.explanation}
                  onChange={(e) => setCountForm({ ...countForm, explanation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Save Physical Count</span>
                </button>
              </div>

            </form>

            {/* PHYSICAL CASH COUNT AUDIT & ADMIN ADJUSTMENT APPROVAL TABLE */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Physical Audit History & Admin Approvals</h3>
                  <p className="text-[11px] text-slate-400">Physical count audit records and pending variance adjustment postings</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  {reconciliations.filter(r => r.status === 'PENDING_APPROVAL').length} Pending Approvals
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Audit Date</th>
                      <th className="py-2.5 px-3 text-right">System Balance</th>
                      <th className="py-2.5 px-3 text-right">Physical Count</th>
                      <th className="py-2.5 px-3 text-right">Difference</th>
                      <th className="py-2.5 px-3">Explanation</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Audited By</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {reconciliations.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{rec.reconciliationDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-semibold">
                          PKR {rec.systemBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-100">
                          PKR {rec.physicalCount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                          rec.difference < 0 ? 'text-rose-400' : rec.difference > 0 ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          PKR {rec.difference.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">{rec.explanation}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-900' :
                            rec.status === 'REJECTED' ? 'bg-rose-950 text-rose-300 border border-rose-900' :
                            'bg-amber-950 text-amber-300 border border-amber-900'
                          }`}>
                            {rec.status === 'PENDING_APPROVAL' ? 'PENDING ADMIN APPROVAL' : rec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-medium">{rec.reconciledBy}</td>
                        <td className="py-2.5 px-3 text-center">
                          {rec.status === 'PENDING_APPROVAL' && rec.difference !== 0 ? (
                            <button
                              onClick={() => handleApproveReconciliation(rec.id)}
                              disabled={loading}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition disabled:opacity-50"
                            >
                              Approve Adjustment
                            </button>
                          ) : rec.status === 'APPROVED' ? (
                            <span className="text-[10px] text-slate-500 font-mono">Posted</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">Balanced</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reconciliations.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500 italic">
                          No physical cash audit reconciliations recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: PETTY CASH AUDIT & REGISTER (INLINE SECTION 5) */}
        {activeTab === 'AUDIT_REGISTER' && (
          <div className="space-y-6">
            
            {/* AUDIT SUMMARY STATS CARD */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <History className="h-5 w-5 text-amber-400" />
                <h2 className="text-sm font-bold text-slate-100">Petty Cash Audit Overview</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">System Balance</span>
                  <p className="font-mono font-bold text-amber-400 text-sm">
                    PKR {(config?.currentBalance || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Cash Added</span>
                  <p className="font-mono font-bold text-emerald-400 text-sm">
                    PKR {(config?.totalAdded || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Expenses</span>
                  <p className="font-mono font-bold text-rose-400 text-sm">
                    PKR {(config?.totalExpenses || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Total Replenished</span>
                  <p className="font-mono font-bold text-blue-400 text-sm">
                    PKR {(config?.totalReplenished || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Physical Cash</span>
                  <p className="font-mono font-bold text-slate-200 text-sm">
                    PKR {(config?.physicalCount !== undefined ? config.physicalCount : config?.currentBalance || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Difference</span>
                  <p className={`font-mono font-bold text-sm ${
                    (config?.difference || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    PKR {(config?.difference || 0).toLocaleString()}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Last Audit Date</span>
                  <p className="font-mono text-slate-300 truncate">
                    {config?.lastAuditDate || 'Not Audited'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Last Audited By</span>
                  <p className="font-bold text-slate-300 truncate">
                    {config?.lastAuditedBy || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* REGISTER TRANSACTION HISTORY TABLE & FILTERS */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by voucher #, description, recipient, category, or user..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
                  >
                    <option value="">All Transaction Types</option>
                    <option value="TRANSFER_IN">Cash Added</option>
                    <option value="EXPENSE">Expense</option>
                    <option value="REPLENISHMENT">Replenishment</option>
                    <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
                  </select>

                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
                  />

                  <span className="text-slate-500">to</span>

                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none"
                  />

                  {(searchTerm || typeFilter || startDateFilter || endDateFilter) && (
                    <button
                      onClick={() => { setSearchTerm(''); setTypeFilter(''); setStartDateFilter(''); setEndDateFilter(''); }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Voucher #</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Category / Account</th>
                      <th className="py-3 px-3">Paid To</th>
                      <th className="py-3 px-3 text-right">Debit (PKR)</th>
                      <th className="py-3 px-3 text-right">Credit (PKR)</th>
                      <th className="py-3 px-3 text-right">Running Balance</th>
                      <th className="py-3 px-3">Created By</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredRegister.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-mono text-slate-400">{row.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">{row.voucherNo}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.transactionType === 'EXPENSE' ? 'bg-rose-950 text-rose-300 border border-rose-900/50' :
                            row.transactionType === 'TRANSFER_IN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-900/50' :
                            'bg-blue-950 text-blue-300 border border-blue-900/50'
                          }`}>
                            {row.transactionType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium max-w-xs truncate">{row.narration}</td>
                        <td className="py-3 px-3 text-slate-400">{row.expenseCategory}</td>
                        <td className="py-3 px-3 text-slate-400">{row.paidTo}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                          {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-400 font-semibold">
                          {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                          PKR {row.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-medium">{row.createdBy || 'System Admin'}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setSelectedVoucher(row); setIsVoucherOpen(true); }}
                              title="Print Official Voucher Slip"
                              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRevertTxId(row.id)}
                              title="Revert Transaction (Admin)"
                              className="p-1.5 rounded-lg border border-slate-800 hover:bg-rose-950 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRegister.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                          No Petty Cash transactions found matching the audit search filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: FUND SETTINGS (INLINE CARD) */}
        {activeTab === 'SETTINGS' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Sliders className="h-6 w-6 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-100">Petty Cash Fund Settings</h2>
                  <p className="text-xs text-slate-400">Configure imprest fund capacity ceiling and custodian permissions</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfigSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Authorized Imprest Fund Limit (PKR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={configForm.fundLimit}
                  onChange={(e) => setConfigForm({ ...configForm, fundLimit: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Maximum cumulative deposit capacity allowed for Petty Cash</p>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Fund Custodian Name *</label>
                <input
                  type="text"
                  required
                  value={configForm.custodianName}
                  onChange={(e) => setConfigForm({ ...configForm, custodianName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Person responsible for holding and disbursing petty cash funds</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        )}

        {/* INLINE REVERT CONFIRMATION BANNER */}
        {revertTxId && (
          <div className="rounded-xl border border-rose-800/80 bg-rose-950/90 p-5 shadow-2xl space-y-3 max-w-xl">
            <div className="flex items-center justify-between border-b border-rose-900/60 pb-2">
              <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-rose-400" />
                <span>Confirm Transaction Reversal</span>
              </h3>
              <button onClick={() => setRevertTxId(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to revert this posted transaction? The corresponding accounting journal entry lines will be reversed automatically and GL balances recalculated.
            </p>

            <form onSubmit={handleRevertSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reason for Reversal *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter reason for reverting this transaction..."
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRevertTxId(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-900">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold">Confirm Reversal</button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Printable Voucher Slip Modal */}
      <PettyCashVoucherModal
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        voucher={selectedVoucher}
      />

    </DashboardLayout>
  );
};
