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
  X
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { usePettyCashStore } from '../store/pettyCashStore';
import { useCoaStore } from '../store/coaStore';
import { PettyCashVoucherModal } from '../components/common/PettyCashVoucherModal';
export const PettyCash = () => {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const {
    config,
    register,
    loading,
    error,
    fetchConfig,
    fetchRegister,
    addCash,
    recordExpense,
    replenish,
    updateConfig,
    reconcile,
    revertTransaction
  } = usePettyCashStore();

  const { accounts, fetchAccounts } = useCoaStore();

  // Active Modals & Drawer State
  const [activeModal, setActiveModal] = useState(null); // 'ADD_CASH' | 'EXPENSE' | 'REPLENISH' | 'RECONCILE' | 'CONFIG'
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    amount: '',
    sourceAccountId: '',
    expenseAccountId: '',
    paidTo: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    narration: '',
    physicalCount: '',
    explanation: '',
    fundLimit: '',
    custodianName: '',
    revertReason: ''
  });

  const [revertTxId, setRevertTxId] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchRegister();
    fetchAccounts();
  }, [fetchConfig, fetchRegister, fetchAccounts]);

  const handleRefresh = useCallback(() => {
    fetchConfig();
    fetchRegister();
    fetchAccounts();
  }, [fetchConfig, fetchRegister, fetchAccounts]);

  // Source Accounts (Cash & Bank)
  const cashBankAccounts = useMemo(() => {
    return accounts.filter(a => 
      !a.isDeleted && 
      a.accountLevel === 'GL' &&
      a.accountName !== 'Petty Cash' &&
      (
        (a.detailType || '').toLowerCase() === 'bank' ||
        (a.detailType || '').toLowerCase() === 'cash' ||
        a.accountName.toLowerCase().includes('bank') ||
        a.accountName.toLowerCase().includes('cash')
      )
    );
  }, [accounts]);

  // Expense Accounts
  const expenseAccounts = useMemo(() => {
    return accounts.filter(a => 
      !a.isDeleted && 
      a.accountLevel === 'GL' &&
      a.accountType?.name?.toUpperCase() === 'EXPENSE'
    );
  }, [accounts]);

  // Filtered Register Rows
  const filteredRegister = useMemo(() => {
    return register.filter(row => {
      const matchesSearch = 
        row.voucherNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.paidTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.expenseCategory.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = !typeFilter || row.transactionType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [register, searchTerm, typeFilter]);

  // Form Submissions
  const handleSubmitAddCash = async (e) => {
    e.preventDefault();
    try {
      await addCash({
        sourceAccountId: formData.sourceAccountId,
        amount: parseFloat(formData.amount),
        date: formData.date,
        referenceNo: formData.referenceNo,
        narration: formData.narration,
        createdById: '00000000-0000-0000-0000-000000000000'
      });
      showToast('Cash added to Petty Cash successfully!', 'success');
      setActiveModal(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Failed to add cash to Petty Cash', 'error');
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    try {
      await recordExpense({
        expenseAccountId: formData.expenseAccountId,
        amount: parseFloat(formData.amount),
        paidTo: formData.paidTo,
        date: formData.date,
        referenceNo: formData.referenceNo,
        narration: formData.narration,
        createdById: '00000000-0000-0000-0000-000000000000'
      });
      showToast('Petty Cash Expense recorded successfully!', 'success');
      setActiveModal(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Failed to record Petty Cash expense', 'error');
    }
  };

  const handleSubmitReplenish = async (e) => {
    e.preventDefault();
    try {
      await replenish({
        sourceAccountId: formData.sourceAccountId,
        amount: parseFloat(formData.amount),
        date: formData.date,
        referenceNo: formData.referenceNo,
        narration: formData.narration || 'Petty Cash Fund Replenishment',
        createdById: '00000000-0000-0000-0000-000000000000'
      });
      showToast('Petty Cash fund replenished successfully!', 'success');
      setActiveModal(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Failed to replenish Petty Cash fund', 'error');
    }
  };

  const handleSubmitConfig = async (e) => {
    e.preventDefault();
    try {
      await updateConfig({
        fundLimit: parseFloat(formData.fundLimit),
        custodianName: formData.custodianName
      });
      showToast('Petty Cash configuration updated!', 'success');
      setActiveModal(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Failed to update configuration', 'error');
    }
  };

  const handleSubmitReconcile = async (e) => {
    e.preventDefault();
    try {
      await reconcile({
        physicalCount: parseFloat(formData.physicalCount),
        explanation: formData.explanation,
        reconciledById: '00000000-0000-0000-0000-000000000000'
      });
      showToast('Reconciliation submitted for approval!', 'success');
      setActiveModal(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Reconciliation submission failed', 'error');
    }
  };

  const handleRevert = async (e) => {
    e.preventDefault();
    if (!revertTxId) return;
    try {
      await revertTransaction(revertTxId, formData.revertReason || 'Admin Reversal');
      showToast('Transaction reverted successfully!', 'success');
      setRevertTxId(null);
      resetForm();
    } catch (err) {
      showToast(err.message || 'Failed to revert transaction', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      sourceAccountId: '',
      expenseAccountId: '',
      paidTo: '',
      date: new Date().toISOString().split('T')[0],
      referenceNo: '',
      narration: '',
      physicalCount: '',
      explanation: '',
      fundLimit: config?.fundLimit || 50000,
      custodianName: config?.custodianName || '',
      revertReason: ''
    });
  };

  const openConfigModal = () => {
    setFormData(prev => ({
      ...prev,
      fundLimit: config?.fundLimit || 50000,
      custodianName: config?.custodianName || 'Authorized Custodian'
    }));
    setActiveModal('CONFIG');
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
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? <AlertCircle className="h-4 w-4 text-rose-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
        )}
        
        {/* Top Title & Actions */}
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
              onClick={openConfigModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              <Sliders className="h-4 w-4 text-slate-400" />
              <span>Configure Fund</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-5 shadow-none space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Current Balance</span>
            <p className="text-2xl font-black font-mono text-amber-400">
              PKR {(config?.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">GL Code: {config?.glCode || '1010104'}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-none space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authorized Fund Limit</span>
            <p className="text-2xl font-black font-mono text-slate-100">
              PKR {(config?.fundLimit || 50000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">Imprest Capacity Ceiling</p>
          </div>

          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-5 shadow-none space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Available Capacity</span>
            <p className="text-2xl font-black font-mono text-emerald-400">
              PKR {(config?.availableCapacity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">Maximum Deposit Space</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-none space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fund Custodian</span>
            <p className="text-base font-bold text-slate-200 truncate mt-1">
              {config?.custodianName || 'Authorized Custodian'}
            </p>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
              Status: {config?.status || 'ACTIVE'}
            </span>
          </div>

        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => { resetForm(); setActiveModal('ADD_CASH'); }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-bold text-xs hover:bg-emerald-900/80 transition"
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>Add Cash</span>
          </button>

          <button
            onClick={() => { resetForm(); setActiveModal('EXPENSE'); }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 font-bold text-xs hover:bg-rose-900/80 transition"
          >
            <MinusCircle className="h-4 w-4 text-rose-400" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => { resetForm(); setActiveModal('REPLENISH'); }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-950/60 border border-blue-800/50 text-blue-300 font-bold text-xs hover:bg-blue-900/80 transition"
          >
            <ArrowDownLeft className="h-4 w-4 text-blue-400" />
            <span>Replenish Fund</span>
          </button>

          <button
            onClick={() => { resetForm(); setActiveModal('RECONCILE'); }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-300 font-bold text-xs hover:bg-amber-900/80 transition"
          >
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>Physical Audit</span>
          </button>
        </div>

        {/* Filter & Register Section */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 space-y-4">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search voucher, description, recipient, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
            >
              <option value="">All Transaction Types</option>
              <option value="TRANSFER_IN">Cash Added</option>
              <option value="EXPENSE">Expense</option>
              <option value="REPLENISHMENT">Replenishment</option>
              <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
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
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredRegister.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition">
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
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setSelectedVoucher(row); setIsVoucherOpen(true); }}
                          title="Print Voucher"
                          className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setRevertTxId(row.id)}
                          title="Revert Transaction"
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
                    <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                      No Petty Cash transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* ── MODALS ── */}

      {/* Add Cash Modal */}
      {activeModal === 'ADD_CASH' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-400" />
                <span>Add Cash to Petty Cash</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitAddCash} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Source Account (Cash or Bank)</label>
                <select
                  required
                  value={formData.sourceAccountId}
                  onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Source Account</option>
                  {cashBankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.glCode} - {a.accountName} (Bal: PKR {Number(a.currentBalance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 10000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reference / Cheque Number</label>
                <input
                  type="text"
                  placeholder="Optional reference"
                  value={formData.referenceNo}
                  onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Narration / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Description for journal posting"
                  value={formData.narration}
                  onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Transfer to Petty Cash</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {activeModal === 'EXPENSE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <MinusCircle className="h-4 w-4 text-rose-400" />
                <span>Record Petty Cash Expense</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Expense Account Category</label>
                <select
                  required
                  value={formData.expenseAccountId}
                  onChange={(e) => setFormData({ ...formData, expenseAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Expense Account</option>
                  {expenseAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.glCode} - {a.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Paid To / Recipient</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stationary Shop / Driver"
                  value={formData.paidTo}
                  onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Narration / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Description of small operational expense"
                  value={formData.narration}
                  onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold">Post Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replenish Modal */}
      {activeModal === 'REPLENISH' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                <span>Replenish Petty Cash Fund</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitReplenish} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Replenishing Bank Account</label>
                <select
                  required
                  value={formData.sourceAccountId}
                  onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                >
                  <option value="">Select Bank Account</option>
                  {cashBankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.glCode} - {a.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Replenishment Amount (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={`Suggested: ${config?.availableCapacity || 0}`}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">Post Replenishment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Modal */}
      {activeModal === 'CONFIG' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                <span>Configure Petty Cash Fund</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitConfig} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Authorized Fund Limit (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.fundLimit}
                  onChange={(e) => setFormData({ ...formData, fundLimit: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Custodian Name</label>
                <input
                  type="text"
                  required
                  value={formData.custodianName}
                  onChange={(e) => setFormData({ ...formData, custodianName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {activeModal === 'RECONCILE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>Physical Petty Cash Count Audit</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmitReconcile} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] font-bold uppercase">System Recorded Balance</span>
                <p className="text-lg font-mono font-bold text-amber-400">
                  PKR {(config?.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Physical Cash Counted (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Actual physical cash in drawer"
                  value={formData.physicalCount}
                  onChange={(e) => setFormData({ ...formData, physicalCount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Explanation / Variance Notes</label>
                <textarea
                  rows={2}
                  placeholder="Explain any physical count variance"
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold">Submit Audit Count</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revert Modal */}
      {revertTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-900/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-rose-400" />
                <span>Revert Posted Petty Cash Transaction</span>
              </h3>
              <button onClick={() => setRevertTxId(null)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleRevert} className="space-y-3 text-xs">
              <p className="text-slate-300">
                Are you sure you want to revert this posted transaction? The corresponding accounting journal entry lines will be reversed automatically.
              </p>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reason for Reversal</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter reason for reverting this transaction..."
                  value={formData.revertReason}
                  onChange={(e) => setFormData({ ...formData, revertReason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setRevertTxId(null)} className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold">Confirm Reversal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher Slip Printable Modal */}
      <PettyCashVoucherModal
        isOpen={isVoucherOpen}
        onClose={() => setIsVoucherOpen(false)}
        voucher={selectedVoucher}
      />

    </DashboardLayout>
  );
};
