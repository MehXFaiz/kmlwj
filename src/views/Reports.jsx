import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { reportsService } from '../services/apiServices';
import { showToast } from '../components/ui/Toast';
import { FileText, Banknote, PieChart, Activity, RefreshCw, BookOpen } from 'lucide-react';
import { DesktopOnly, MobileOnly } from '../components/common/responsive';
import { useNavigate } from 'react-router-dom';

export const Reports = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('trial-balance');
  const [isLoading, setIsLoading] = useState(false);
  
  const [trialBalanceData, setTrialBalanceData] = useState(null);
  const [incomeStatementData, setIncomeStatementData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);

  const fetchReport = async (tab) => {
    setIsLoading(true);
    try {
      if (tab === 'trial-balance') {
        const data = await reportsService.getTrialBalance();
        setTrialBalanceData(data);
      } else if (tab === 'income-statement') {
        const data = await reportsService.getIncomeStatement();
        setIncomeStatementData(data);
      } else if (tab === 'balance-sheet') {
        const data = await reportsService.getBalanceSheet();
        setBalanceSheetData(data);
      }
    } catch (err) {
      showToast('Failed to load report data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  const handleRefresh = () => {
    fetchReport(activeTab);
    showToast('Report refreshed');
  };

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '—';
    return `Rs ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <DashboardLayout breadcrumbs={["Reports", "Financial Statements"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Financial Reports</h2>
          <p className="text-xs text-slate-500">Real-time aggregate financial statements based on posted ledger entries.</p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 mb-6 overflow-x-auto pb-1 hide-scrollbar">
        <button
          onClick={() => setActiveTab('trial-balance')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'trial-balance'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" /> Trial Balance
        </button>
        <button
          onClick={() => setActiveTab('income-statement')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'income-statement'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Banknote className="h-4 w-4" /> Income Statement
        </button>
        <button
          onClick={() => setActiveTab('balance-sheet')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'balance-sheet'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="h-4 w-4" /> Balance Sheet
        </button>
        <button
          onClick={() => navigate('/ledger')}
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
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                    <th className="py-3 px-4 w-32">GL Code</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-4 w-40 text-right">Debit</th>
                    <th className="py-3 px-4 w-40 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {trialBalanceData.entries.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-brand-400">{row.glCode}</td>
                      <td className="py-3.5 px-4 text-slate-200">{row.accountName}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">{row.debit > 0 ? formatMoney(row.debit) : '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">{row.credit > 0 ? formatMoney(row.credit) : '—'}</td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr className="bg-slate-900/40 font-bold border-t-2 border-slate-700">
                    <td colSpan={2} className="py-4 px-4 text-right text-slate-300 uppercase tracking-wider">Report Totals</td>
                    <td className={`py-4 px-4 text-right font-mono ${trialBalanceData.summary.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                      {formatMoney(trialBalanceData.summary.totalDebit)}
                    </td>
                    <td className={`py-4 px-4 text-right font-mono ${trialBalanceData.summary.isBalanced ? 'text-brand-400' : 'text-red-400'}`}>
                      {formatMoney(trialBalanceData.summary.totalCredit)}
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
                <p className="text-sm text-slate-500 mt-1">As of {new Date().toLocaleDateString()}</p>
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
                <p className="text-sm text-slate-500 mt-1">As of {new Date().toLocaleDateString()}</p>
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
                    <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-400 border-b border-slate-700 pb-2">Equity</h4>
                    <div className="space-y-1">
                      {balanceSheetData.equity.map((row) => (
                        <div key={row.id} className={`flex justify-between items-center py-2 text-sm ${row.isNetIncome ? 'italic' : ''}`}>
                          <span className={`${row.isNetIncome ? 'text-indigo-300' : 'text-slate-300'}`}>{row.accountName}</span>
                          <span className={`font-mono ${row.isNetIncome ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {row.sign < 0 ? `(${formatMoney(row.balance)})` : formatMoney(row.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-slate-800/60 font-bold text-sm">
                      <span className="text-slate-400 text-xs uppercase tracking-widest">Total Equity</span>
                      <span className="font-mono text-indigo-400">{formatMoney(balanceSheetData.summary.totalEquity)}</span>
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
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
