import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLedgerStore } from '../store/ledgerStore';
import { useCoaStore } from '../store/coaStore';
import { Search, Calendar, Filter, Plus, Trash2, X } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';

export const GeneralLedger = () => {
  const { ledgerData, fetchLedger, isLoading } = useLedgerStore();
  const { accounts, fetchAccounts } = useCoaStore();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: ''
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    accountId: '',
    postingDate: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    type: 'Debit',
    amount: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.accountId || !newEntry.amount || Number(newEntry.amount) <= 0) {
      showToast('error', 'Please select an account and enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    const debit = newEntry.type === 'Debit' ? Number(newEntry.amount) : 0;
    const credit = newEntry.type === 'Credit' ? Number(newEntry.amount) : 0;
    
    const res = await useLedgerStore.getState().addLedgerEntry({
      accountId: newEntry.accountId,
      postingDate: newEntry.postingDate,
      reference: newEntry.reference,
      description: newEntry.description,
      debit,
      credit
    }, filters);

    setIsSubmitting(false);
    if (res.success) {
      showToast('success', 'GL Entry added successfully');
      setIsModalOpen(false);
      setNewEntry({
        accountId: '',
        postingDate: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        type: 'Debit',
        amount: ''
      });
    } else {
      showToast('error', res.error || 'Failed to add GL entry');
    }
  };

  const handleDeleteEntry = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this General Ledger entry? This will reverse its effect on the account balance.')) {
      const res = await useLedgerStore.getState().deleteLedgerEntry(id, filters);
      if (res.success) {
        showToast('success', 'GL Entry deleted successfully');
      } else {
        showToast('error', res.error || 'Failed to delete GL entry');
      }
    }
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
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} className="gap-2 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-emerald-500/10 cursor-pointer">
            <Plus className="h-4 w-4" /> Add GL Entry
          </Button>
        </div>
      </div>

      {/* Add GL Entry Modal / Drawer */}
      {isModalOpen && (
        <Card className="bg-slate-900/90 border-emerald-500/40 shadow-xl shadow-emerald-500/10 animate-in fade-in duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-800/80">
            <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" /> New General Ledger Entry
            </CardTitle>
            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Account <span className="text-red-400">*</span></label>
                  <select
                    value={newEntry.accountId}
                    onChange={(e) => setNewEntry({ ...newEntry, accountId: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.type})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={newEntry.postingDate}
                    onChange={(e) => setNewEntry({ ...newEntry, postingDate: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. GL-ADJ-001"
                    value={newEntry.reference}
                    onChange={(e) => setNewEntry({ ...newEntry, reference: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <input
                    type="text"
                    placeholder="Brief details or justification for this adjustment"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Entry Type & Amount <span className="text-red-400">*</span></label>
                  <div className="flex gap-2">
                    <select
                      value={newEntry.type}
                      onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-2 py-2 focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                      <option value="Debit">Debit (+)</option>
                      <option value="Credit">Credit (-)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={newEntry.amount}
                      onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                      required
                      className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/60">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
              <span className="text-xl font-mono font-semibold text-slate-200">PKR {summary.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Period Debits</span>
              <span className="text-xl font-mono font-semibold text-emerald-400">PKR {summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Period Credits</span>
              <span className="text-xl font-mono font-semibold text-red-400">PKR {summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-brand-500/30">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-1 text-brand-400">Closing Balance</span>
              <span className="text-xl font-mono font-bold text-brand-400">PKR {summary.closingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                    <th className="py-3 px-4 w-20 text-center">Actions</th>
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
                        {entry.debit > 0 ? `PKR ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-red-400">
                        {entry.credit > 0 ? `PKR ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteEntry(entry.id, e)}
                          title="Delete GL Entry"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-900/40 font-bold border-t-2 border-slate-800">
                    <td colSpan={!accountInfo ? 4 : 3} className="py-3.5 px-4 text-right text-slate-400 uppercase">Period Totals</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">PKR {summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-400">PKR {summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ToastPlaceholder />
    </div>
  );
};
