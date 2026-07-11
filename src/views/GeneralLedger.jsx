import { useState, useEffect, useMemo, startTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLedgerStore } from '../store/ledgerStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { Search, Calendar, Filter, Trash2, AlertCircle, Printer } from 'lucide-react';
import { showToast, ToastPlaceholder } from '../components/ui/Toast';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';
import logoImg from '../assets/logo.png';

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d)) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

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

  const { accountInfo, entries, summary, accountMeta } = useMemo(() => {
    if (!ledgerData) return { accountInfo: null, entries: [], summary: { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 }, accountMeta: {} };
    return {
      accountInfo: ledgerData.account || null,
      entries: ledgerData.entries || [],
      summary: ledgerData.summary || { totalDebit: 0, totalCredit: 0, openingBalance: 0, closingBalance: 0 },
      accountMeta: ledgerData.accountMeta || {}
    };
  }, [ledgerData]);

  const groupedLedgers = useMemo(() => {
    if (accountInfo) {
      const code = accountInfo.glCode || '000';
      const meta = accountMeta[code] || null;
      const accType = accountInfo.type || meta?.type || 'ASSET';
      const opBal = summary.openingBalance !== undefined && summary.openingBalance !== null ? summary.openingBalance : (meta?.openingBalance || 0);
      
      return [{
        glCode: code,
        accountName: accountInfo.name || meta?.name || 'Unknown Account',
        type: accType,
        openingBalance: opBal,
        entries: entries || []
      }];
    }

    if (!entries || entries.length === 0) return [];
    
    const map = new Map();
    entries.forEach(entry => {
      const code = entry.glCode || '000';
      if (!map.has(code)) {
        const meta = accountMeta[code] || null;
        const accType = meta?.type || (accountInfo && accountInfo.glCode === code ? accountInfo.type : 'ASSET');
        const opBal = meta?.openingBalance !== undefined ? meta.openingBalance : (accountInfo && accountInfo.glCode === code ? summary.openingBalance : 0);
        
        map.set(code, {
          glCode: code,
          accountName: entry.accountName || meta?.name || (accountInfo && accountInfo.glCode === code ? accountInfo.name : 'Unknown Account'),
          type: accType,
          openingBalance: opBal,
          entries: []
        });
      }
      map.get(code).entries.push(entry);
    });
    
    return Array.from(map.values()).sort((a, b) => a.glCode.localeCompare(b.glCode));
  }, [entries, accountInfo, accountMeta, summary]);

  useEffect(() => {
    fetchAccounts();
    fetchLedger();
  }, [fetchAccounts, fetchLedger]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    if (name === 'accountId') {
      fetchLedger(newFilters);
      setSelectedIds([]);
    }
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

  const isDebitNormal = accountInfo && ['ASSET', 'EXPENSE'].includes(accountInfo.type.toUpperCase());
  const debitLabel = isDebitNormal ? "Period Debits (In)" : (accountInfo ? "Period Debits (Out)" : "Period Debits");
  const creditLabel = isDebitNormal ? "Period Credits (Out)" : (accountInfo ? "Period Credits (In)" : "Period Credits");

  const debitColor = isDebitNormal ? "text-emerald-400" : (accountInfo ? "text-red-400" : "text-emerald-400");
  const creditColor = isDebitNormal ? "text-red-400" : (accountInfo ? "text-emerald-400" : "text-red-400");
  const tableDebitColor = isDebitNormal ? "text-emerald-400" : (accountInfo ? "text-red-400" : "text-emerald-400");
  const tableCreditColor = isDebitNormal ? "text-red-400" : (accountInfo ? "text-emerald-400" : "text-red-400");

  return (
    <div className="space-y-6">
      {/* Landscape Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Print-only Header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            <img src={logoImg} alt="Logo" className="w-14 h-14 object-contain" />
          </div>
          <div className="flex-1 text-center">
            <h1
              className="text-xl font-extrabold text-slate-900 leading-snug font-urdu"
            >
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-[11px] font-bold text-slate-600 mt-1">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
            </p>
            <p className="text-[10px] font-bold text-slate-500 mt-0.5">REGISTERED NO: 1319</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white mb-2">
              General Ledger Report
            </div>
            <div className="text-[10px] text-slate-600 font-bold uppercase block tracking-wider">
              Printed On: {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>
        
        {/* Date Filter Range info */}
        <div className="mt-4 flex justify-between text-xs text-slate-700 font-medium">
          <div>
            <span className="font-bold text-slate-900">Period:</span> {filters.startDate ? formatDateDDMMYYYY(filters.startDate) : 'Beginning'} to {filters.endDate ? formatDateDDMMYYYY(filters.endDate) : 'Present'}
          </div>
          <div>
            <span className="font-bold text-slate-900">Account:</span> {accountInfo ? `${accountInfo.name} (${accountInfo.glCode})` : 'All Accounts'}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
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
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-all text-xs font-semibold cursor-pointer shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print GL
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 print:hidden">
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
                <option key={acc.id} value={acc.id}>{acc.name}</option>
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
              <span className={`text-xs uppercase tracking-wider mb-1 ${debitColor}`}>{debitLabel}</span>
              <span className={`text-xl font-mono font-semibold ${debitColor}`}>PKR {summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50">
            <CardContent className="p-4 flex flex-col items-center justify-center">
              <span className={`text-xs uppercase tracking-wider mb-1 ${creditColor}`}>{creditLabel}</span>
              <span className={`text-xl font-mono font-semibold ${creditColor}`}>PKR {summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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

      {/* Grouped Ledger Tables - One Separate Table per GL Account */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-400 font-medium">Loading ledger data...</CardContent>
        </Card>
      ) : groupedLedgers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500 italic">No ledger entries found for the selected criteria.</CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedLedgers.map((group) => {
            const isDebitNorm = ['ASSET', 'EXPENSE'].includes((group.type || '').toUpperCase());
            let runningBal = group.openingBalance;
            let totalGroupDebit = 0;
            let totalGroupCredit = 0;

            const rowsWithBal = group.entries.map((entry) => {
              const deb = entry.debit || 0;
              const cred = entry.credit || 0;
              totalGroupDebit += deb;
              totalGroupCredit += cred;
              if (isDebitNorm) {
                runningBal = runningBal + deb - cred;
              } else {
                runningBal = runningBal + cred - deb;
              }
              return { ...entry, runningBalance: runningBal };
            });
            const closingBal = runningBal;

            return (
              <div
                key={group.glCode}
                className="bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/80"
              >
                {/* Textbook-inspired Modern Ledger Header */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-extrabold tracking-widest uppercase text-amber-500 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      GENERAL LEDGER
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-100 flex flex-wrap items-center gap-2">
                      Account Name: <span className="text-amber-400 underline decoration-amber-500/40 underline-offset-4 font-black">{group.accountName}</span>
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 flex flex-col items-start sm:items-end min-w-[140px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Number</span>
                      <span className="text-base font-mono font-black text-slate-200">{group.glCode}</span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 flex flex-col items-start sm:items-end min-w-[160px]">
                      <span className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wider">Closing Balance</span>
                      <span className="text-base font-mono font-bold text-amber-400">
                        PKR {Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs ml-1 opacity-80">{closingBal < 0 ? '(Cr)' : '(Dr)'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table for this Account */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                        {canEditOrDelete && (
                          <th className="py-3 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={group.entries.length > 0 && group.entries.every(ent => selectedIds.includes(ent.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const idsToAdd = group.entries.map(ent => ent.id).filter(id => !selectedIds.includes(id));
                                  setSelectedIds(prev => [...prev, ...idsToAdd]);
                                } else {
                                  const grpIds = group.entries.map(ent => ent.id);
                                  setSelectedIds(prev => prev.filter(id => !grpIds.includes(id)));
                                }
                              }}
                              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                            />
                          </th>
                        )}
                        <th className="py-3 px-4 w-28">Date</th>
                        <th className="py-3 px-4">Explanation / Description</th>
                        <th className="py-3 px-4 w-24">Ref</th>
                        <th className="py-3 px-4 w-32 text-right text-emerald-400/90">Debit</th>
                        <th className="py-3 px-4 w-32 text-right text-rose-400/90">Credit</th>
                        <th className="py-3 px-4 w-36 text-right font-black text-amber-400">Balance</th>
                        {canEditOrDelete && <th className="py-3 px-4 w-16 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-800/40">
                      {/* Beginning Balance Row */}
                      <tr className="bg-slate-800/20 text-slate-400 font-medium italic">
                        {canEditOrDelete && <td className="py-3 px-4" />}
                        <td className="py-3 px-4 text-slate-300 font-semibold">{filters.startDate || 'Beg. Balance'}</td>
                        <td className="py-3 px-4 text-slate-300 font-semibold">Beg. Balance</td>
                        <td className="py-3 px-4 font-mono text-slate-500">—</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">—</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">—</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-300">
                          {group.openingBalance === 0 ? '—' : `PKR ${group.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </td>
                        {canEditOrDelete && <td className="py-3 px-4" />}
                      </tr>

                      {/* Transaction Rows */}
                      {rowsWithBal.length === 0 ? (
                        <tr>
                          <td
                            colSpan={canEditOrDelete ? 8 : 7}
                            className="py-6 px-4 text-center text-slate-500 italic bg-slate-900/10"
                          >
                            No transaction entries found for this account in the selected period.
                          </td>
                        </tr>
                      ) : (
                        rowsWithBal.map((entry) => (
                          <tr
                            key={entry.id}
                            className={`hover:bg-slate-900/40 transition-colors ${selectedIds.includes(entry.id) ? 'bg-amber-500/10' : ''}`}
                          >
                            {canEditOrDelete && (
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(entry.id)}
                                  onChange={(e) => handleSelectOne(entry.id, e)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap">{entry.date}</td>
                            <td className="py-3 px-4 text-slate-200">{entry.description || '—'}</td>
                            <td className="py-3 px-4 font-mono text-amber-400/90 whitespace-nowrap">{entry.reference}</td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-400">
                              {entry.debit > 0 ? `PKR ${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-400">
                              {entry.credit > 0 ? `PKR ${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-100 bg-slate-900/40">
                              PKR {Math.abs(entry.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <span className="text-[10px] ml-1 opacity-70 font-normal">{entry.runningBalance < 0 ? '(Cr)' : ''}</span>
                            </td>
                            {canEditOrDelete && (
                              <td className="py-3 px-4 text-center">
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
                        ))
                      )}

                      {/* Account Period Totals Row */}
                      <tr className="bg-slate-950/80 font-extrabold border-t-2 border-slate-800 text-xs">
                        <td
                          colSpan={canEditOrDelete ? 4 : 3}
                          className="py-3.5 px-4 text-right text-slate-400 uppercase tracking-wider"
                        >
                          Account Totals
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                          PKR {totalGroupDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                          PKR {totalGroupCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-400">
                          PKR {Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {canEditOrDelete && <td className="py-3.5 px-4" />}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
