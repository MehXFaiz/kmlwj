import React, { useState, useEffect } from 'react';
import { useOpeningBalanceStore } from '../store/openingBalanceStore';
import { useFinancialYearStore } from '../store/financialYearStore';
import { useAuthStore } from '../store/authStore';
import {
  Wallet, ShieldCheck, ShieldAlert, Lock, Unlock, ArrowRight,
  RefreshCw, CheckCircle2, AlertTriangle, Info, Calendar, DollarSign,
  Edit3, Save, History, Layers
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export function OpeningBalances() {
  const { user } = useAuthStore();
  const { years, fetchFinancialYears } = useFinancialYearStore();
  const {
    financialYear, openingDate, isAutoRolled, sourceFinancialYear,
    sourceClosingDate, adjustmentReason, hasPreviousYear, accounts,
    allAccounts, batch, loading, saving, error, fetchOpeningBalances,
    saveOpeningBalances
  } = useOpeningBalanceStore();

  const [selectedFy, setSelectedFy] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [formBalances, setFormBalances] = useState({});
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  useEffect(() => {
    fetchFinancialYears();
    fetchOpeningBalances();
  }, []);

  useEffect(() => {
    if (financialYear) setSelectedFy(financialYear);
    if (openingDate) setSelectedDate(openingDate);

    // Initialize balance inputs
    const initialInputs = {};
    if (allAccounts && allAccounts.length > 0) {
      allAccounts.forEach(acc => {
        initialInputs[acc.glCode] = acc.amount ?? 0;
      });
    }
    setFormBalances(initialInputs);
  }, [financialYear, openingDate, allAccounts]);

  const handleFyChange = async (newFy) => {
    setSelectedFy(newFy);
    const { startYear } = parseFyCode(newFy);
    const dateStr = `${startYear}-07-01`;
    setSelectedDate(dateStr);
    await fetchOpeningBalances(dateStr);
  };

  function parseFyCode(code) {
    const clean = (code || '').replace(/[^0-9-]/g, '');
    const parts = clean.split('-');
    const startYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const endYear = parts[1] ? parseInt(parts[1], 10) : startYear + 1;
    return { startYear, endYear };
  }

  const handleInputChange = (glCode, value) => {
    const num = parseFloat(value);
    setFormBalances(prev => ({
      ...prev,
      [glCode]: isNaN(num) ? 0 : num
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (isAutoRolled) {
      showToast.error('Automatically rolled balances are locked. Use "Adjust Opening Balance" to make an explicit adjustment.');
      return;
    }

    try {
      await saveOpeningBalances(selectedDate, formBalances);
      showToast.success(`Opening balances for ${selectedFy} saved successfully!`);
    } catch (err) {
      // Error handled in store
    }
  };

  const handleExecuteAdjustment = async () => {
    if (!adjustReason || adjustReason.trim().length < 5) {
      showToast.error('Please provide a detailed adjustment reason (at least 5 characters).');
      return;
    }

    setAdjusting(true);
    try {
      await saveOpeningBalances(selectedDate, formBalances, true, adjustReason);
      showToast.success('Opening balance adjustment recorded with audit trail!');
      setIsAdjustModalOpen(false);
      setAdjustReason('');
    } catch (err) {
      showToast.error(err.message || 'Failed to adjust opening balances');
    } finally {
      setAdjusting(false);
    }
  };

  // Primary Accounts for quick entry / key presentation
  const primaryCodes = ['1010101', '1010102', '1010103', '1010104', '1010301', '1010201'];
  const displayAccounts = (allAccounts && allAccounts.length > 0)
    ? allAccounts
    : primaryCodes.map(code => ({ glCode: code, accountName: getAccountName(code), accountType: 'ASSET', amount: formBalances[code] || 0 }));

  function getAccountName(code) {
    switch (code) {
      case '1010101': return 'National Bank of Pakistan';
      case '1010102': return 'NBP Zakat Bank';
      case '1010103': return 'Cash in Hand';
      case '1010104': return 'Petty Cash';
      case '1010301': return 'Advances & Loans';
      case '1010201': return 'Accounts Receivable';
      default: return `GL Account ${code}`;
    }
  }

  const totalOpeningAmount = Object.values(formBalances).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-800/60">
              Accounting Cycle
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Opening Balances
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization starting balances for each financial year cycle.
          </p>
        </div>

        {/* Financial Year Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={selectedFy}
              onChange={(e) => handleFyChange(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
            >
              {years.map(y => (
                <option key={y.id || y.code} value={y.code} className="bg-slate-900 text-white">
                  {y.code} {y.isClosed ? '(Closed)' : ''}
                </option>
              ))}
              {!years.some(y => y.code === selectedFy) && (
                <option value={selectedFy} className="bg-slate-900 text-white">{selectedFy}</option>
              )}
            </select>
          </div>

          <button
            onClick={() => fetchOpeningBalances(selectedDate)}
            disabled={loading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-colors"
            title="Refresh opening balances"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Status Banner & Source Card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Source Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Source Verification</span>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {isAutoRolled ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span>Automatically Rolled Forward from {sourceFinancialYear}</span>
                  </>
                ) : hasPreviousYear ? (
                  <>
                    <Info className="h-5 w-5 text-amber-400" />
                    <span>Previous Financial Year Detected</span>
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5 text-amber-400" />
                    <span>Initial Opening Balance Setup</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAutoRolled
                  ? `Balances automatically carried forward from ${sourceFinancialYear} closing balances as of ${sourceClosingDate || 'year end'}.`
                  : hasPreviousYear
                  ? 'Opening balances will be automatically carried forward when previous financial year is closed.'
                  : 'Organization first-year setup. Enter initial starting balances for cash, bank, and asset accounts.'}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {isAutoRolled ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Locked (Auto-Rolled)
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1.5">
                  <Unlock className="h-3.5 w-3.5" /> Editable Initial Setup
                </span>
              )}

              {batch?.voucherNo && (
                <span className="text-[11px] font-mono text-slate-500">
                  Voucher: {batch.voucherNo}
                </span>
              )}
            </div>
          </div>

          {adjustmentReason && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
              <History className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Adjustment Note:</span> {adjustmentReason}
              </div>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total Opening Debits</span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1">
              PKR {totalOpeningAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Opening Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isAutoRolled}
              className="bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs px-2.5 py-1 rounded-lg focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Main Accounts Table Form ── */}
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Account Opening Balances</h2>
          </div>

          {isAutoRolled && isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 transition-colors flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" /> Adjust Opening Balance
            </button>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="py-3.5 px-6">GL Code</th>
                <th className="py-3.5 px-6">Account Name</th>
                <th className="py-3.5 px-6">Category / Type</th>
                <th className="py-3.5 px-6 text-right">Opening Balance (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {displayAccounts.map((acc) => {
                const isPrimary = primaryCodes.includes(acc.glCode);
                const val = formBalances[acc.glCode] ?? 0;

                return (
                  <tr key={acc.glCode} className={`hover:bg-slate-800/30 transition-colors ${isPrimary ? 'bg-amber-950/10' : ''}`}>
                    <td className="py-3.5 px-6 font-mono font-bold text-amber-400">
                      {acc.glCode}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-100">
                      {acc.accountName}
                      {isPrimary && (
                        <span className="ml-2 text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Primary
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-slate-400 font-medium">
                      {acc.accountType || acc.detailType || 'Asset'}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {isAutoRolled ? (
                        <span className="font-mono font-bold text-slate-100 text-sm">
                          {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={val}
                          onChange={(e) => handleInputChange(acc.glCode, e.target.value)}
                          className="w-48 bg-slate-950 border border-slate-800 focus:border-amber-500 text-right font-mono font-bold text-amber-300 px-3 py-1.5 rounded-xl focus:outline-none transition-colors"
                          placeholder="0.00"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isAutoRolled && (
          <div className="p-6 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              * Opening balances will post through the double-entry accounting engine to Opening Equity.
            </span>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all duration-150 flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Opening Balances</span>
            </button>
          </div>
        )}
      </form>

      {/* ── Adjustment Reason Modal ── */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-950/80 border border-amber-800/60 rounded-xl text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Adjust Opening Balance</h3>
                <p className="text-xs text-slate-400">Explicit adjustment audit trail required.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are adjusting auto-rolled opening balances for <span className="font-bold text-amber-400">{selectedFy}</span>. An audit trail entry will record your user name, timestamp, previous amount, new amount, and reason.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Adjustment Reason / Reference *</label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Audited bank reconciliation correction per FY 2026 audit report..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAdjustment}
                disabled={adjusting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2"
              >
                {adjusting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Confirm & Adjust
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
