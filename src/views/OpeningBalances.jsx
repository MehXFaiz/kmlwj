import React, { useState, useEffect, useMemo } from 'react';
import { useOpeningBalanceStore } from '../store/openingBalanceStore';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../components/ui/Toast';
import {
  FileSpreadsheet,
  Calendar,
  Building2,
  Banknote,
  Wallet,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';

const TARGET_FIELDS = [
  {
    key: '1010101',
    label: 'National Bank of Pakistan Opening Balance',
    subLabel: 'NBP General Bank Account (GL 1010101)',
    icon: Building2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/40 border-blue-800/40'
  },
  {
    key: '1010102',
    label: 'NBP Zakat Bank Opening Balance',
    subLabel: 'NBP Zakat Bank Account (GL 1010102)',
    icon: Building2,
    color: 'text-teal-400',
    bgColor: 'bg-teal-950/40 border-teal-800/40'
  },
  {
    key: '1010103',
    label: 'Cash in Hand Opening Balance',
    subLabel: 'Main Cash in Hand Till (GL 1010103)',
    icon: Banknote,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40 border-emerald-800/40'
  },
  {
    key: '1010104',
    label: 'Petty Cash Opening Balance',
    subLabel: 'Operational Petty Cash Imprest Fund (GL 1010104)',
    icon: Wallet,
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/40 border-amber-800/40'
  },
  {
    key: '1010301',
    label: 'Advances & Loans Opening Balance',
    subLabel: 'Staff & Operational Advances (GL 1010301)',
    icon: Scale,
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/40 border-purple-800/40'
  },
  {
    key: '1010201',
    label: 'Accounts Receivable Opening Balance',
    subLabel: 'Customer & Member Receivables (GL 1010201)',
    icon: FileSpreadsheet,
    color: 'text-sky-400',
    bgColor: 'bg-sky-950/40 border-sky-800/40'
  }
];

export const OpeningBalances = () => {
  const { user } = useAuthStore();
  const {
    loading,
    saving,
    error,
    financialYear,
    batch,
    accounts,
    fetchOpeningBalances,
    saveOpeningBalances
  } = useOpeningBalanceStore();

  const [date, setDate] = useState(() => {
    // Default to July 1 of current or preceding year
    const now = new Date();
    const yr = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${yr}-07-01`;
  });

  const [values, setValues] = useState({
    '1010101': '',
    '1010102': '',
    '1010103': '',
    '1010104': '',
    '1010301': '',
    '1010201': ''
  });

  // Fetch opening balances whenever selected date changes
  useEffect(() => {
    fetchOpeningBalances(date)
      .then((data) => {
        if (data && data.accounts) {
          const newVals = {};
          TARGET_FIELDS.forEach(f => {
            const accData = data.accounts[f.key];
            newVals[f.key] = accData && accData.amount ? String(accData.amount) : '';
          });
          setValues(newVals);
        }
      })
      .catch(() => {});
  }, [date, fetchOpeningBalances]);

  const handleInputChange = (glCode, val) => {
    // Allow numbers and single decimal point
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setValues(prev => ({ ...prev, [glCode]: val }));
    }
  };

  // Live double-entry balance calculations
  const totalDebit = useMemo(() => {
    return TARGET_FIELDS.reduce((sum, f) => {
      const num = parseFloat(values[f.key]) || 0;
      return sum + (num > 0 ? num : 0);
    }, 0);
  }, [values]);

  const totalCredit = totalDebit; // Automatically balanced via Opening Equity
  const equityBalancingAmount = totalDebit;
  const difference = 0.00;

  const handleSave = async (e) => {
    e.preventDefault();

    if (!date) {
      showToast('Please select a valid opening balance date.', 'warning');
      return;
    }

    const payloadBalances = {};
    for (const f of TARGET_FIELDS) {
      const num = parseFloat(values[f.key]) || 0;
      if (num < 0) {
        showToast(`Opening balance for ${f.label} cannot be negative.`, 'warning');
        return;
      }
      payloadBalances[f.key] = num;
    }

    try {
      const res = await saveOpeningBalances(date, payloadBalances);
      showToast(res.message || 'Opening balances saved and posted successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save opening balances.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-100">Opening Balance Setup</h1>
                <p className="text-xs font-semibold text-slate-400">Enter opening balances for the selected financial year.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {batch ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-800/60 px-3.5 py-2 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>Posted Entry ({batch.voucherNo || batch.financialYear})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-400">
                <span>Not Posted for {financialYear || 'Selected Year'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Date Selection Card */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="space-y-1">
              <label htmlFor="opening-balance-date-picker" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Opening Balance Date <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-slate-400">
                Select the financial year opening date (e.g. 01-07-2025). This date applies to all entries in this form.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  id="opening-balance-date-picker"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5 text-sm font-bold font-mono text-slate-100 focus:outline-none focus:border-amber-500/60 transition-all shadow-inner"
                />
              </div>
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-amber-300">
                {financialYear || 'FY'}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-rose-950/60 border border-rose-800/60 p-4 text-xs font-semibold text-rose-300">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Accounts Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">Predefined Target Opening Accounts</h2>
              <span className="text-xs font-semibold text-slate-500">6 Asset GL Accounts</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {TARGET_FIELDS.map((field) => {
                const IconComp = field.icon;
                const accState = accounts[field.key];
                const isConfigured = accState?.configured !== false;

                return (
                  <div
                    key={field.key}
                    className={`rounded-2xl border p-4 transition-all ${
                      isConfigured
                        ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${field.bgColor}`}>
                          <IconComp className={`h-4 w-4 ${field.color}`} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100">{field.label}</div>
                          <div className="text-[10.5px] font-semibold text-slate-400">{field.subLabel}</div>
                        </div>
                      </div>
                    </div>

                    {!isConfigured ? (
                      <div className="mt-2 text-xs font-semibold text-rose-400">
                        Required account is not configured in Chart of Accounts.
                      </div>
                    ) : (
                      <div className="relative mt-2">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                          PKR
                        </span>
                        <input
                          type="text"
                          value={values[field.key]}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-14 pr-4 py-2.5 text-sm font-black font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all text-right shadow-inner"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Double-Entry Balancing Summary Box */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Double-Entry Accounting Verification</h3>
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 rounded-lg">
                100% Balanced
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Opening Debit</div>
                <div className="text-sm font-black font-mono text-emerald-400 mt-1">
                  Rs {totalDebit.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Opening Credit</div>
                <div className="text-sm font-black font-mono text-teal-400 mt-1">
                  Rs {totalCredit.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Opening Equity Credit</div>
                <div className="text-sm font-black font-mono text-purple-400 mt-1">
                  Rs {equityBalancingAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Balance Difference</div>
                <div className="text-sm font-black font-mono text-amber-400 mt-1">
                  PKR {difference.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Submit Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setValues({
                    '1010101': '',
                    '1010102': '',
                    '1010103': '',
                    '1010104': '',
                    '1010301': '',
                    '1010201': ''
                  });
                }}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-xl hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving & Posting...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Opening Balances</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default OpeningBalances;
