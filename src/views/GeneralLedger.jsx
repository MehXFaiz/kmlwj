import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLedgerStore } from '../store/ledgerStore';
import { useCoaStore } from '../store/coaStore';
import { Search, Calendar, Filter } from 'lucide-react';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';

export const GeneralLedger = () => {
  const { ledgerData, fetchLedger, isLoading } = useLedgerStore();
  const { accounts, fetchAccounts } = useCoaStore();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: ''
  });

  useEffect(() => {
    fetchAccounts();
    // Fetch initial generic ledger view
    fetchLedger({});
  }, [fetchAccounts, fetchLedger]);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyFilters = () => {
    fetchLedger(filters);
  };

  const clearFilters = () => {
    const defaultFilters = { startDate: '', endDate: '', accountId: '' };
    setFilters(defaultFilters);
    fetchLedger({});
  };

  const summary = ledgerData?.summary || { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 };
  const entries = ledgerData?.entries || [];
  const accountInfo = ledgerData?.account;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">General Ledger</h2>
          <p className="text-xs text-slate-400">View detailed transaction history and balances for specific accounts.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">Account</label>
            <select
              name="accountId"
              value={filters.accountId}
              onChange={handleFilterChange}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2"
            >
              <option value="">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2"
            />
          </div>

          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={clearFilters} className="w-full sm:w-auto">Clear</Button>
            <Button variant="primary" size="sm" onClick={applyFilters} className="w-full sm:w-auto gap-2">
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {accountInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Opening Balance</span>
              <span className="text-xl font-mono font-semibold text-slate-200">${summary.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Period Debits</span>
              <span className="text-xl font-mono font-semibold text-emerald-400">${summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Period Credits</span>
              <span className="text-xl font-mono font-semibold text-red-400">${summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-brand-500/30">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1 text-brand-400">Closing Balance</span>
              <span className="text-xl font-mono font-bold text-brand-400">${summary.closingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>{accountInfo ? `Ledger: ${accountInfo.glCode} - ${accountInfo.name}` : 'All Ledger Entries'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading ledger data...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">No ledger entries found for the selected criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                    <th className="py-3 px-4 w-32">Date</th>
                    <th className="py-3 px-4 w-28">Ref</th>
                    {!accountInfo && <th className="py-3 px-4 w-32">Account</th>}
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 w-32 text-right">Debit</th>
                    <th className="py-3 px-4 w-32 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4 text-slate-300 font-medium">{entry.date}</td>
                      <td className="py-3.5 px-4 font-mono text-brand-400">{entry.reference}</td>
                      {!accountInfo && (
                        <td className="py-3.5 px-4 font-mono">
                          <Badge variant="outline">{entry.glCode}</Badge>
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-slate-200">{entry.description || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                        {entry.debit > 0 ? `$${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-red-400">
                        {entry.credit > 0 ? `$${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-900/40 font-bold border-t-2 border-slate-800">
                    <td colSpan={!accountInfo ? 4 : 3} className="py-3.5 px-4 text-right text-slate-400 uppercase">Period Totals</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">${summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-400">${summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
