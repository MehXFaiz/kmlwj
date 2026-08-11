import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { reportsService } from '../services/apiServices';
import { useCoaStore } from '../store/coaStore';
import { useDashboardStore } from '../store/dashboardStore';
import { showToast } from '../components/ui/Toast';
import { FileText, Banknote, PieChart, Activity, RefreshCw, BookOpen, Calendar, Filter, RotateCcw, Printer } from 'lucide-react';
import { DesktopOnly, MobileOnly } from '../components/common/responsive';
import { useNavigate, useSearchParams } from 'react-router-dom';

const calculatePresetDates = (presetKey, fy) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  switch (presetKey) {
    case 'this-fiscal-year':
      return { startDate: `${fy}-01-01`, endDate: `${fy}-12-31` };
    case 'this-month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: formatDateStr(start), endDate: formatDateStr(end) };
    }
    case 'last-month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { startDate: formatDateStr(start), endDate: formatDateStr(end) };
    }
    case 'this-quarter': {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      return { startDate: formatDateStr(start), endDate: formatDateStr(end) };
    }
    case 'ytd': {
      return { startDate: `${fy}-01-01`, endDate: formatDateStr(now) };
    }
    case 'all-time':
      return { startDate: '', endDate: '' };
    default:
      return null;
  }
};

export const Reports = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'trial-balance';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(false);

  const [trialBalanceData, setTrialBalanceData] = useState(null);
  const [incomeStatementData, setIncomeStatementData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [cashFlowData, setCashFlowData] = useState(null);
  const { fiscalYear } = useCoaStore();

  const [startDate, setStartDate] = useState(() => searchParams.get('startDate') ?? `${fiscalYear}-01-01`);
  const [endDate, setEndDate] = useState(() => searchParams.get('endDate') ?? `${fiscalYear}-12-31`);
  const [preset, setPreset] = useState(() => searchParams.get('preset') ?? 'this-fiscal-year');

  // Watch global mutation version
  const { version } = useDashboardStore();
  const isFirstRender = useRef(true);

  const reportParams = useMemo(() => {
    const p = {};
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [startDate, endDate]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  const updateSearchParams = (pPreset, pStart, pEnd, pTab) => {
    const newParams = { tab: pTab };
    if (pStart) newParams.startDate = pStart;
    if (pEnd) newParams.endDate = pEnd;
    if (pPreset && pPreset !== 'custom') newParams.preset = pPreset;
    setSearchParams(newParams);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    updateSearchParams(preset, startDate, endDate, tab);
  };

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    if (newPreset === 'custom') return;
    const computed = calculatePresetDates(newPreset, fiscalYear);
    if (computed) {
      setStartDate(computed.startDate);
      setEndDate(computed.endDate);
      updateSearchParams(newPreset, computed.startDate, computed.endDate, activeTab);
    }
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    setPreset('custom');
    updateSearchParams('custom', val, endDate, activeTab);
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    setPreset('custom');
    updateSearchParams('custom', startDate, val, activeTab);
  };

  const handleResetDates = () => {
    const defaultStart = `${fiscalYear}-01-01`;
    const defaultEnd = `${fiscalYear}-12-31`;
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setPreset('this-fiscal-year');
    updateSearchParams('this-fiscal-year', defaultStart, defaultEnd, activeTab);
  };

  const handleGLClick = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    navigate(`/ledger${qs ? `?${qs}` : ''}`);
  };

  const fetchReport = async (tab) => {
    setIsLoading(true);
    try {
      if (tab === 'trial-balance') {
        const data = await reportsService.getTrialBalance(reportParams);
        setTrialBalanceData(data);
      } else if (tab === 'income-statement') {
        const data = await reportsService.getIncomeStatement(reportParams);
        setIncomeStatementData(data);
      } else if (tab === 'balance-sheet') {
        const data = await reportsService.getBalanceSheet(reportParams);
        setBalanceSheetData(data);
      } else if (tab === 'cash-flow') {
        const data = await reportsService.getCashFlow(reportParams);
        setCashFlowData(data);
      }
    } catch (err) {
      showToast('Failed to load report data', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, reportParams]);

  // Re-fetch whenever any mutation happens (journal post/cancel/delete, voucher, etc.)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchReport(activeTab);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    fetchReport(activeTab);
    showToast('Report refreshed');
  };

  const handlePrint = () => {
    window.print();
  };

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '—';
    return `Rs ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <DashboardLayout breadcrumbs={["Reports", "Financial Statements"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Financial Reports</h2>
          <p className="text-xs text-slate-500">Real-time aggregate financial statements based on posted ledger entries.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" className="gap-2 shrink-0 border-slate-700 hover:bg-slate-800 print:hidden">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={handleRefresh} disabled={isLoading} className="gap-2 shrink-0 print:hidden">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
          </Button>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Preset Selector */}
            <div className="flex flex-col gap-1 min-w-[170px]">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date Preset</label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
              >
                <option value="this-fiscal-year">This Fiscal Year ({fiscalYear})</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="this-quarter">This Quarter</option>
                <option value="ytd">Year To Date (YTD)</option>
                <option value="all-time">All Time</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Start Date input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <span className="self-end pb-2 text-slate-500 font-bold hidden sm:inline">–</span>

            {/* End Date input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Reset Button */}
            {(startDate !== `${fiscalYear}-01-01` || endDate !== `${fiscalYear}-12-31` || preset !== 'this-fiscal-year') && (
              <button
                onClick={handleResetDates}
                title="Reset to default fiscal year"
                className="self-end pb-2 px-2 text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Active Period Summary Badge */}
          <div className="flex items-center gap-2 text-xs bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80 text-slate-300 self-start lg:self-auto">
            <Filter className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-slate-400">Period:</span>
            <span className="font-mono text-amber-400 font-medium">
              {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : 'All Time'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 mb-6 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => handleTabChange('trial-balance')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'trial-balance'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" /> Trial Balance
        </button>
        <button
          onClick={() => handleTabChange('income-statement')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'income-statement'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Banknote className="h-4 w-4" /> Income Statement
        </button>
        <button
          onClick={() => handleTabChange('balance-sheet')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'balance-sheet'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="h-4 w-4" /> Balance Sheet
        </button>
        <button
          onClick={() => handleTabChange('cash-flow')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'cash-flow'
              ? 'border-amber-500 text-amber-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <RefreshCw className="h-4 w-4" /> Cash Flow
        </button>
        <button
          onClick={handleGLClick}
          className="pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-slate-400 hover:text-slate-200 whitespace-nowrap flex items-center gap-2 ml-4"
        >
          <BookOpen className="h-4 w-4" /> General Ledger
        </button>
      </div>

      <Card className="min-h-[50vh]">
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-12 text-center text-slate-400 animate-pulse">Loading dynamic report data...</div>
          )}

          {/* TRIAL BALANCE */}
          {!isLoading && activeTab === 'trial-balance' && trialBalanceData && (
            <div className="overflow-x-auto">
              <div className="px-4 pt-4 text-xs font-semibold text-slate-500 flex justify-between items-center">
                <span>Period: {trialBalanceData.summary?.periodLabel || `FY ${fiscalYear}`}</span>
              </div>
              {trialBalanceData.openingBalances && (
                <div className="p-4 bg-slate-950/40 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Opening Balances</h4>
                  <div className="flex flex-wrap gap-2">
                    {['banks', 'cashInHand', 'advanceAndLoan', 'receivable', 'otherAssets'].flatMap(k => (
                      (trialBalanceData.openingBalances[k]?.accounts || []).map(acc => (
                        <div key={acc.glCode} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
                          <span className="text-slate-400 font-medium">{acc.name} Opening Bal: </span>
                          <span className="font-mono font-bold text-slate-200 ml-1">{acc.balance ? formatMoney(acc.balance) : '—'}</span>
                        </div>
                      ))
                    ))}
                  </div>
                </div>
              )}
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                    <th className="py-3 px-4 w-28">GL Code</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-4 w-36 text-right">Opening Bal</th>
                    <th className="py-3 px-4 w-36 text-right">Period Debit</th>
                    <th className="py-3 px-4 w-36 text-right">Period Credit</th>
                    <th className="py-3 px-4 w-36 text-right">Closing Bal</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {trialBalanceData.entries.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-brand-400">{row.glCode}</td>
                      <td className="py-3.5 px-4 text-slate-200">{row.accountName}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">{row.openingBalance ? formatMoney(row.openingBalance) : '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">{row.debit > 0 ? formatMoney(row.debit) : '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-teal-400">{row.credit > 0 ? formatMoney(row.credit) : '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-400">{row.closingBalance ? formatMoney(row.closingBalance) : (row.balance ? formatMoney(row.balance) : '—')}</td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr className="bg-slate-900/40 font-bold border-t-2 border-slate-700">
                    <td colSpan={3} className="py-4 px-4 text-right text-slate-300 uppercase tracking-wider">Report Totals</td>
                    <td className={`py-4 px-4 text-right font-mono ${trialBalanceData.summary.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                      {formatMoney(trialBalanceData.summary.totalDebit)}
                    </td>
                    <td className={`py-4 px-4 text-right font-mono ${trialBalanceData.summary.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                      {formatMoney(trialBalanceData.summary.totalCredit)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-amber-400">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
              {!trialBalanceData.summary.isBalanced && (
                <div className="p-4 bg-red-950/20 border-t border-red-900/50 text-red-400 text-xs font-bold text-center">
                  WARNING: The Trial Balance is out of balance.
                </div>
              )}
            </div>
          )}

          {/* INCOME STATEMENT */}
          {!isLoading && activeTab === 'income-statement' && incomeStatementData && (
            <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-100 uppercase tracking-widest">Income Statement</h3>
                <p className="text-sm text-slate-500 mt-1">{incomeStatementData.summary?.periodLabel || `FY ${fiscalYear}`}</p>
              </div>

              {/* Revenues */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 border-b border-slate-800 pb-2">Revenue</h4>
                <div className="space-y-1">
                  {incomeStatementData.revenues.map((row) => (
                    <div key={row.id} className="flex justify-between items-center py-2 text-sm">
                      <span className="text-slate-300">{row.accountName} <span className="text-[10px] text-slate-600 ml-2 font-mono">({row.glCode})</span></span>
                      <span className="font-mono text-slate-200">{formatMoney(row.balance)}</span>
                    </div>
                  ))}
                  {incomeStatementData.revenues.length === 0 && <p className="text-xs text-slate-500 italic py-2">No revenue accounts found.</p>}
                </div>
                <div className="flex justify-between items-center py-3 border-t border-slate-800/60 font-bold text-sm">
                  <span className="text-slate-100">Total Revenue</span>
                  <span className="font-mono text-emerald-400">{formatMoney(incomeStatementData.summary.totalRevenue)}</span>
                </div>
              </div>

              {/* Expenses */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 border-b border-slate-800 pb-2">Operating Expenses</h4>
                <div className="space-y-1">
                  {incomeStatementData.expenses.map((row) => (
                    <div key={row.id} className="flex justify-between items-center py-2 text-sm">
                      <span className="text-slate-300">{row.accountName} <span className="text-[10px] text-slate-600 ml-2 font-mono">({row.glCode})</span></span>
                      <span className="font-mono text-slate-200">{formatMoney(row.balance)}</span>
                    </div>
                  ))}
                  {incomeStatementData.expenses.length === 0 && <p className="text-xs text-slate-500 italic py-2">No expense accounts found.</p>}
                </div>
                <div className="flex justify-between items-center py-3 border-t border-slate-800/60 font-bold text-sm">
                  <span className="text-slate-100">Total Expenses</span>
                  <span className="font-mono text-red-400">{formatMoney(incomeStatementData.summary.totalExpense)}</span>
                </div>
              </div>

              {/* Net Income */}
              <div className={`flex justify-between items-center p-4 rounded-lg font-bold text-lg border-2 ${incomeStatementData.summary.netIncome >= 0 ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' : 'bg-red-950/20 border-red-900/50 text-red-400'}`}>
                <span>Net Income</span>
                <span className="font-mono">{formatMoney(incomeStatementData.summary.netIncome)}</span>
              </div>
            </div>
          )}

          {/* BALANCE SHEET */}
          {!isLoading && activeTab === 'balance-sheet' && balanceSheetData && (
            <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-100 uppercase tracking-widest">Balance Sheet</h3>
                <p className="text-sm text-slate-500 mt-1">{balanceSheetData.summary?.periodLabel || `FY ${fiscalYear}`}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                {/* Left Side: Assets */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-brand-400 border-b border-slate-700 pb-2">Assets</h4>
                    <div className="space-y-1">
                      {balanceSheetData.assets.map((row) => (
                        <div key={row.id} className="flex justify-between items-center py-2 text-sm">
                          <span className="text-slate-300">{row.accountName}</span>
                          <span className="font-mono text-slate-200">{formatMoney(row.balance)}</span>
                        </div>
                      ))}
                      {balanceSheetData.assets.length === 0 && <p className="text-xs text-slate-500 italic py-2">No asset accounts found.</p>}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 border-t-2 border-slate-700 font-bold text-base">
                    <span className="text-slate-100 uppercase tracking-widest text-xs">Total Assets</span>
                    <span className="font-mono text-brand-400">{formatMoney(balanceSheetData.summary.totalAssets)}</span>
                  </div>
                </div>

                {/* Right Side: Liabilities & Equity */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-orange-400 border-b border-slate-700 pb-2">Liabilities</h4>
                    <div className="space-y-1">
                      {balanceSheetData.liabilities.map((row) => (
                        <div key={row.id} className="flex justify-between items-center py-2 text-sm">
                          <span className="text-slate-300">{row.accountName}</span>
                          <span className="font-mono text-slate-200">{formatMoney(row.balance)}</span>
                        </div>
                      ))}
                      {balanceSheetData.liabilities.length === 0 && <p className="text-xs text-slate-500 italic py-2">No liability accounts found.</p>}
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-slate-800/60 font-bold text-sm">
                      <span className="text-slate-400 text-xs uppercase tracking-widest">Total Liabilities</span>
                      <span className="font-mono text-orange-400">{formatMoney(balanceSheetData.summary.totalLiabilities)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-amber-400 border-b border-slate-700 pb-2">Equity</h4>
                    <div className="space-y-1">
                      {balanceSheetData.equity.map((row) => (
                        <div key={row.id} className={`flex justify-between items-center py-2 text-sm ${row.isNetIncome ? 'italic' : ''}`}>
                          <span className={`${row.isNetIncome ? 'text-amber-300' : 'text-slate-300'}`}>{row.accountName}</span>
                          <span className={`font-mono ${row.isNetIncome ? 'text-amber-300' : 'text-slate-200'}`}>
                            {row.sign < 0 ? `(${formatMoney(row.balance)})` : formatMoney(row.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-slate-800/60 font-bold text-sm">
                      <span className="text-slate-400 text-xs uppercase tracking-widest">Total Equity</span>
                      <span className="font-mono text-amber-400">{formatMoney(balanceSheetData.summary.totalEquity)}</span>
                    </div>
                  </div>

                  <div className={`flex justify-between items-center py-3 border-t-2 border-slate-700 font-bold text-base ${balanceSheetData.summary.isBalanced ? '' : 'text-red-400'}`}>
                    <span className="text-slate-100 uppercase tracking-widest text-xs">Total Liabilities & Equity</span>
                    <span className="font-mono text-brand-400">{formatMoney(balanceSheetData.summary.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
              
              {!balanceSheetData.summary.isBalanced && (
                <div className="p-4 mt-8 bg-red-950/20 border border-red-900/50 text-red-400 text-xs font-bold text-center rounded-lg">
                  WARNING: The Balance Sheet is out of balance. Assets = {formatMoney(balanceSheetData.summary.totalAssets)} vs L+E = {formatMoney(balanceSheetData.summary.totalLiabilitiesAndEquity)}
                </div>
              )}
            </div>
          )}

          {/* CASH FLOW */}
          {!isLoading && activeTab === 'cash-flow' && cashFlowData && (
            <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-100 uppercase tracking-widest">Cash Flow Statement</h3>
                <p className="text-sm text-slate-500 mt-1">{cashFlowData.summary?.periodLabel || `FY ${fiscalYear}`}</p>
              </div>

              {/* Dynamic Opening & Closing Balance Summary Header Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-lg">
                <div className="text-center p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Opening Cash & Bank</p>
                  <p className="text-sm font-mono font-black text-blue-400 mt-1">{formatMoney(cashFlowData.summary?.beginningCash)}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Inflows (+)</p>
                  <p className="text-sm font-mono font-black text-emerald-400 mt-1">{formatMoney(cashFlowData.summary?.totalInflow)}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Outflows (-)</p>
                  <p className="text-sm font-mono font-black text-rose-400 mt-1">{formatMoney(cashFlowData.summary?.totalOutflow)}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Closing Cash & Bank</p>
                  <p className="text-sm font-mono font-black text-amber-400 mt-1">{formatMoney(cashFlowData.summary?.endingCash)}</p>
                </div>
              </div>

              {/* By Activity (Operating / Investing / Financing) */}
              {cashFlowData.categorySummary && (
                <div className="max-w-lg mx-auto space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">By Activity</h4>
                  {['Operating', 'Investing', 'Financing'].map((cat) => (
                    <div key={cat} className="flex justify-between items-center py-1.5 text-sm">
                      <span className="text-slate-300">{cat}</span>
                      <span className={`font-mono ${cashFlowData.categorySummary[cat].net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatMoney(cashFlowData.categorySummary[cat].net)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                {/* Inflows */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 border-b border-slate-800 pb-2 flex justify-between">
                    <span>Cash Inflows</span>
                    <span>Amount</span>
                  </h4>
                  <div className="space-y-1">
                    {cashFlowData.inflows.map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-sm">
                        <span className="text-slate-300">{row.accountName}{row.category && row.category !== 'Operating' && <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">({row.category})</span>}</span>
                        <span className="font-mono text-slate-200">{formatMoney(row.amount)}</span>
                      </div>
                    ))}
                    {cashFlowData.inflows.length === 0 && <p className="text-xs text-slate-500 italic py-2">No cash inflows recorded.</p>}
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-slate-800/60 font-bold text-sm">
                    <span className="text-slate-100">Total Cash Inflows</span>
                    <span className="font-mono text-emerald-400">{formatMoney(cashFlowData.summary.totalInflow)}</span>
                  </div>
                </div>

                {/* Outflows */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 border-b border-slate-800 pb-2 flex justify-between">
                    <span>Cash Outflows</span>
                    <span>Amount</span>
                  </h4>
                  <div className="space-y-1">
                    {cashFlowData.outflows.map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-sm">
                        <span className="text-slate-300">{row.accountName}{row.category && row.category !== 'Operating' && <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">({row.category})</span>}</span>
                        <span className="font-mono text-slate-200">{formatMoney(row.amount)}</span>
                      </div>
                    ))}
                    {cashFlowData.outflows.length === 0 && <p className="text-xs text-slate-500 italic py-2">No cash outflows recorded.</p>}
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-slate-800/60 font-bold text-sm">
                    <span className="text-slate-100">Total Cash Outflows</span>
                    <span className="font-mono text-red-400">{formatMoney(cashFlowData.summary.totalOutflow)}</span>
                  </div>
                </div>
              </div>

              {/* Cash in Hand + Bank — separate reconciliations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Cash in Hand section */}
                {cashFlowData.cashSection && (
                  <div className="bg-slate-950/40 border border-slate-800/70 p-5 rounded-xl space-y-3">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-center border-b border-slate-800 pb-2">Cash in Hand Reconciliation</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Opening Cash</span>
                        <span className="font-mono text-slate-200">{formatMoney(cashFlowData.cashSection.openingBalance)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-emerald-400">
                        <span>+ Cash Receipts</span>
                        <span className="font-mono">{formatMoney(cashFlowData.cashSection.totalReceipts)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-red-400">
                        <span>− Cash Payments</span>
                        <span className="font-mono">{formatMoney(cashFlowData.cashSection.totalPayments)}</span>
                      </div>
                      <div className="flex justify-between py-3 border-t border-slate-800 font-bold text-base text-slate-100">
                        <span>Closing Cash in Hand</span>
                        <span className="font-mono text-brand-400">{formatMoney(cashFlowData.cashSection.closingBalance)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Balance section */}
                {cashFlowData.bankSection && (
                  <div className="bg-slate-950/40 border border-slate-800/70 p-5 rounded-xl space-y-3">
                    <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider text-center border-b border-slate-800 pb-2">Bank Balance Reconciliation</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Opening Bank</span>
                        <span className="font-mono text-slate-200">{formatMoney(cashFlowData.bankSection.openingBalance)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-emerald-400">
                        <span>+ Bank Receipts</span>
                        <span className="font-mono">{formatMoney(cashFlowData.bankSection.totalReceipts)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-red-400">
                        <span>− Bank Payments</span>
                        <span className="font-mono">{formatMoney(cashFlowData.bankSection.totalPayments)}</span>
                      </div>
                      <div className="flex justify-between py-3 border-t border-slate-800 font-bold text-base text-slate-100">
                        <span>Closing Bank Balance</span>
                        <span className="font-mono text-brand-400">{formatMoney(cashFlowData.bankSection.closingBalance)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Combined summary */}
              <div className="bg-slate-950/40 border border-slate-800/70 p-5 rounded-xl space-y-3 max-w-lg mx-auto">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Combined Cash & Bank Reconciliation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Beginning Cash + Bank</span>
                    <span className="font-mono text-slate-200">{formatMoney(cashFlowData.summary.beginningCash)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-400">
                    <span>Net Increase / Decrease</span>
                    <span className="font-mono">{cashFlowData.summary.netChange >= 0 ? `+${formatMoney(cashFlowData.summary.netChange)}` : formatMoney(cashFlowData.summary.netChange)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t border-slate-800 font-bold text-base text-slate-100">
                    <span>Ending Cash + Bank</span>
                    <span className="font-mono text-brand-400">{formatMoney(cashFlowData.summary.endingCash)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
