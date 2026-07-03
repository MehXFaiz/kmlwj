import { useState, useEffect, useMemo, startTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLedgerStore } from '../store/ledgerStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { Search, Calendar, Filter, Trash2, AlertCircle } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';

export const GeneralLedger = () => {
  const { ledgerData, fetchLedger, isLoading } = useLedgerStore();
  const { accounts, fetchAccounts } = useCoaStore();
  const { canEditOrDelete } = useAuthStore();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: ''
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const { accountInfo, entries, summary } = useMemo(() => {
    if (!ledgerData) return { accountInfo: null, entries: [], summary: { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 } };
    return {
      accountInfo: ledgerData.account || null,
      entries: ledgerData.entries || [],
      summary: ledgerData.summary || { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 }
    };
  }, [ledgerData]);

  useEffect(() => {
    fetchAccounts();
    fetchLedger();
  }, [fetchAccounts, fetchLedger]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchLedger(filters);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    const cleared = { startDate: '', endDate: '', accountId: '' };
    setFilters(cleared);
    fetchLedger(cleared);
    setSelectedIds([]);
  };

  const handleDeleteEntry = (entry, e) => {
    e.stopPropagation();
    setConfirmDelete(entry);
  };

  const executeDelete = async (id) => {
    setIsDeleting(true);
    const res = await useLedgerStore.getState().deleteLedgerEntry(id, filters);
    startTransition(() => {
      setIsDeleting(false);
      setConfirmDelete(null);
      if (res.success) {
        showToast('General Ledger entry deleted successfully', 'success');
        setSelectedIds(prev => prev.filter(item => item !== id));
      } else {
        showToast(res.error || 'Failed to delete GL entry', 'error');
      }
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(entries.map(ent => ent.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    const res = await useLedgerStore.getState().bulkDeleteLedgerEntries(selectedIds, filters);
    startTransition(() => {
      setIsDeleting(false);
      setShowBulkConfirm(false);
      if (res.success) {
        showToast(`${selectedIds.length} GL entries deleted successfully`, 'success');
        setSelectedIds([]);
      } else {
        showToast(res.error || 'Failed to bulk delete GL entries', 'error');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">General Ledger</h2>
          <p className="text-xs text-slate-400">View detailed transaction history and balances for specific accounts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditOrDelete && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-900/50 transition-all text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5 pointer-events-none" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
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
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2"
              />
            </div>
          </div>
          
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-slate-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2"
              />
            </div>
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
                    {canEditOrDelete && (
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={entries.length > 0 && selectedIds.length === entries.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 w-32">Date</th>
                    <th className="py-3 px-4 w-28">Ref</th>
                    {!accountInfo && <th className="py-3 px-4 w-32">Account</th>}
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 w-32 text-right">Debit</th>
                    <th className="py-3 px-4 w-32 text-right">Credit</th>
                    {canEditOrDelete && <th className="py-3 px-4 w-20 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {entries.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-slate-900/20 transition-colors ${selectedIds.includes(entry.id) ? 'bg-slate-800/30' : ''}`}>
                      {canEditOrDelete && (
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(entry.id)}
                            onChange={(e) => handleSelectOne(entry.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                          />
                        </td>
                      )}
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
                      {canEditOrDelete && (
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteEntry(entry, e)}
                            title="Delete GL Entry"
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 pointer-events-none" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-900/40 font-bold border-t-2 border-slate-800">
                    <td colSpan={!accountInfo ? (canEditOrDelete ? 5 : 4) : (canEditOrDelete ? 4 : 3)} className="py-3.5 px-4 text-right text-slate-400 uppercase">Period Totals</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">PKR {summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-400">PKR {summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {canEditOrDelete && <td className="py-3.5 px-4"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" /> Confirm Deletion
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete General Ledger entry <span className="font-mono text-brand-400">{confirmDelete.reference}</span>?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              This will automatically reverse its effect on the account balance. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={isDeleting} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary" size="sm"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-1.5 cursor-pointer"
                disabled={isDeleting}
                onClick={() => executeDelete(confirmDelete.id)}
              >
                {isDeleting ? 'Deleting...' : 'Delete Entry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" /> Confirm Bulk Deletion
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete <span className="font-bold text-red-400">{selectedIds.length}</span> selected General Ledger entries?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              This will automatically reverse the financial effects of all selected entries on their respective account balances. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowBulkConfirm(false)} disabled={isDeleting} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary" size="sm"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-1.5 cursor-pointer"
                disabled={isDeleting}
                onClick={executeBulkDelete}
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.length} Entries`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastPlaceholder />
    </div>
  );
};
