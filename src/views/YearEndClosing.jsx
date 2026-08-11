import React, { useState, useEffect } from 'react';
import { useFinancialYearStore } from '../store/financialYearStore';
import { useAuthStore } from '../store/authStore';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ArrowRight, Lock, Unlock, Calendar, FileText, History,
  DollarSign, Activity, ChevronRight, CheckSquare, Zap, Info
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { Link } from 'react-router-dom';

export function YearEndClosing() {
  const { user } = useAuthStore();
  const {
    years, selectedYear, setSelectedYear, fetchFinancialYears,
    validating, validationResult, validateYearEndClosing,
    closing, executeYearEndClosing, reopening, reopenFinancialYear, error
  } = useFinancialYearStore();

  const [closingDate, setClosingDate] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [targetFyToReopen, setTargetFyToReopen] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  useEffect(() => {
    fetchFinancialYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      const { endYear } = parseFyCode(selectedYear);
      setClosingDate(`${endYear}-06-30`);
    }
  }, [selectedYear]);

  function parseFyCode(code) {
    const clean = (code || '').replace(/[^0-9-]/g, '');
    const parts = clean.split('-');
    const startYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const endYear = parts[1] ? parseInt(parts[1], 10) : startYear + 1;
    return { startYear, endYear };
  }

  const handleRunValidation = async () => {
    try {
      await validateYearEndClosing(selectedYear);
    } catch (err) {
      // Error handled in store
    }
  };

  const handleExecuteClosing = async () => {
    try {
      await executeYearEndClosing({
        financialYear: selectedYear,
        closingDate,
        notes: closingNotes
      });
      setIsConfirmModalOpen(false);
      setClosingNotes('');
    } catch (err) {
      // Error handled in store
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenReason || reopenReason.trim().length < 5) {
      showToast.error('Please provide a detailed reason (at least 5 characters) for reopening.');
      return;
    }

    try {
      await reopenFinancialYear(targetFyToReopen, reopenReason);
      setIsReopenModalOpen(false);
      setReopenReason('');
      setTargetFyToReopen('');
    } catch (err) {
      // Error handled in store
    }
  };

  const currentYearObj = years.find(y => y.code === selectedYear);
  const isAlreadyClosed = currentYearObj?.isClosed;
  const closedYears = years.filter(y => y.isClosed);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-800/60">
              Financial Year Cycle
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Financial Year Closing
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Validate year-end integrity, close P&L, and automatically roll forward closing balances to the next financial year.
          </p>
        </div>

        {/* Financial Year Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
            >
              {years.map(y => (
                <option key={y.id || y.code} value={y.code} className="bg-slate-900 text-white">
                  {y.code} {y.isClosed ? '(Closed)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchFinancialYears}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Closing Configuration Card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              <span>Year-End Closing Target</span>
            </h2>
            {isAlreadyClosed ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-800/60 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Closed & Locked
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                <Unlock className="h-3.5 w-3.5" /> Open Financial Year
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Target Financial Year</label>
              <input
                type="text"
                readOnly
                value={selectedYear}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-bold text-amber-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Official Closing Date</label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                disabled={isAlreadyClosed}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-bold text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Run automated checks to verify Trial Balance, draft vouchers, and general ledger consistency.
            </p>
            <button
              onClick={handleRunValidation}
              disabled={validating || isAlreadyClosed}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all flex items-center gap-2 border border-slate-700 disabled:opacity-50"
            >
              {validating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
              <span>Run Automated Validation</span>
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">Automated Accounting Engine</h3>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>Revenue & Expense accounts zeroed out into Retained Earnings.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>Balance sheet closing balances auto-rolled by GL Code.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>Prevents duplicate opening balances across years.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>Atomic database transaction with complete audit trail.</span>
              </li>
            </ul>
          </div>

          {isAlreadyClosed && isAdmin && (
            <button
              onClick={() => {
                setTargetFyToReopen(selectedYear);
                setIsReopenModalOpen(true);
              }}
              className="w-full py-2 rounded-xl text-xs font-bold bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 transition-colors flex items-center justify-center gap-2"
            >
              <Unlock className="h-3.5 w-3.5" /> Reopen {selectedYear}
            </button>
          )}
        </div>
      </div>

      {/* ── Validation Results Section ── */}
      {validationResult && (
        <div className="space-y-4">
          {/* Main Status Alert */}
          {!validationResult.canClose ? (
            <div className="p-5 rounded-2xl bg-red-950/40 border border-red-800/80 flex items-start gap-4">
              <div className="p-2.5 bg-red-900/60 rounded-xl text-red-300 flex-shrink-0">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-red-300">Financial Year Cannot Be Closed</h3>
                <p className="text-xs text-red-200">
                  Automated pre-closing validation detected blocking issues that must be fixed before year-end closing is allowed.
                </p>
                <div className="mt-2 space-y-1">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="text-xs font-mono text-red-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-emerald-900/60 rounded-xl text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-300">All Automated Validations Passed</h3>
                  <p className="text-xs text-emerald-200">
                    Trial balance is balanced, draft entries are cleared, and ledger accounts are consistent. Ready for year-end closing.
                  </p>
                </div>
              </div>

              {!isAlreadyClosed && (
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-6 py-3 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>Execute Year-End Closing</span>
                </button>
              )}
            </div>
          )}

          {/* Validation Checks Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Automated Pre-Closing Audit Checklist</span>
              <span className="text-xs font-mono text-slate-500">{validationResult.checks.length} Verification Checks</span>
            </div>

            <div className="divide-y divide-slate-800/50">
              {validationResult.checks.map((check, idx) => (
                <div key={idx} className="px-6 py-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {check.status === 'PASS' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-slate-200">{check.name}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-[11px]">{check.details}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      check.status === 'PASS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                    }`}>
                      {check.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Closed Years History Table ── */}
      {closedYears.length > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Closed Financial Years History</h2>
            </div>
            <span className="text-xs text-slate-400">{closedYears.length} Year(s) Officially Closed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                <tr>
                  <th className="py-3.5 px-6">Financial Year</th>
                  <th className="py-3.5 px-6">Date Window</th>
                  <th className="py-3.5 px-6">Closed At</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {closedYears.map((fy) => (
                  <tr key={fy.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-amber-400">
                      {fy.code}
                    </td>
                    <td className="py-3.5 px-6 text-slate-300 font-mono">
                      {fy.startDate} to {fy.endDate}
                    </td>
                    <td className="py-3.5 px-6 text-slate-400">
                      {fy.closedAt ? new Date(fy.closedAt).toLocaleString() : 'Closed'}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                        Closed & Locked
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setTargetFyToReopen(fy.code);
                            setIsReopenModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        >
                          Reopen Year
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal for Year Closing ── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/60 rounded-xl text-emerald-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Year-End Closing</h3>
                <p className="text-xs text-slate-400">Financial Year: {selectedYear}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Net P&L Result:</span>
                <span className="font-mono font-bold text-emerald-400">
                  PKR {validationResult?.summary?.netProfitOrLoss?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Closing Date:</span>
                <span className="font-mono text-slate-200">{closingDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Auto-Rollover Next Year:</span>
                <span className="font-bold text-amber-400">
                  {parseFyCode(selectedYear).endYear}-{parseFyCode(selectedYear).endYear + 1}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Closing Notes / Auditor Comments (Optional)</label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="e.g. Annual audit completed cleanly. Net surplus transferred to retained earnings."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClosing}
                disabled={closing}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2"
              >
                {closing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Confirm & Execute Closing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Reopen Modal ── */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-950/80 border border-red-800/60 rounded-xl text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reopen Financial Year</h3>
                <p className="text-xs text-slate-400">Target: {targetFyToReopen}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Reopening a closed financial year allows users to post or edit vouchers in that year again. An immutable Audit Trail entry will record this action.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reopening Reason *</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Audit correction requested by external auditors for JV-2026-08..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                disabled={reopening}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center gap-2"
              >
                {reopening ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
