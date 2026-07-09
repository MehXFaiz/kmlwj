import { useState, useMemo, Fragment, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJournalStore } from '../store/journalStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JournalEntryModal } from '../components/ledger/JournalEntryModal';
import { Plus, Calendar, ChevronDown, ChevronUp, FileSpreadsheet, Check, X, Search, Trash2, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';

export const JournalEntries = () => {
  const { journals, fetchJournals, isLoading, updateJournalStatus, deleteJournalEntry, bulkDeleteJournalEntries } = useJournalStore();
  const { selectedSubsidiary } = useCoaStore();
  const { canEditOrDelete } = useAuthStore();
  const canPostToLedger = useAuthStore((s) => s.canPostToLedger);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedJeId, setExpandedJeId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  useEffect(() => {
    fetchJournals(selectedSubsidiary);
    useCoaStore.getState().fetchAccounts();
  }, [fetchJournals, selectedSubsidiary]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const toggleExpand = (id) => {
    setExpandedJeId(expandedJeId === id ? null : id);
  };

  const handleUpdateStatus = async (dbId, status) => {
    if (window.confirm(`Are you sure you want to change status to ${status}?`)) {
      const res = await updateJournalStatus(dbId, status);
      if (res?.error) {
        alert("Error updating status: " + res.error);
      }
    }
  };

  const handleDeleteJournal = async (dbId, voucherNo) => {
    if (window.confirm(`Are you sure you want to permanently delete journal entry ${voucherNo}? This will remove it from the database and adjust account balances.`)) {
      const res = await deleteJournalEntry(dbId);
      if (res?.error) {
        alert("Error deleting journal entry: " + res.error);
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredJournals.map(je => je.dbId || je.id));
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
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await bulkDeleteJournalEntries(selectedIds);
      showToast(`${selectedIds.length} journal entry(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete journal entries', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const filteredJournals = useMemo(() => {
    return journals.filter((je) => {
      const matchesSubsidiary = selectedSubsidiary === 'Global' || je.subsidiary === selectedSubsidiary;
      if (!matchesSubsidiary) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        je.voucherNo.toLowerCase().includes(q) ||
        (je.reference || '').toLowerCase().includes(q) ||
        (je.description || '').toLowerCase().includes(q)
      );
    });
  }, [journals, selectedSubsidiary, searchQuery]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Posted': return <Badge variant="success" className="text-[9px]">Posted</Badge>;
      case 'Draft': return <Badge variant="secondary" className="text-[9px] bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">Draft</Badge>;
      case 'Cancelled': return <Badge variant="destructive" className="text-[9px]">Cancelled</Badge>;
      default: return <Badge className="text-[9px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider">Journal Entries Ledger</h2>
          <p className="text-xs text-slate-400">Post manual adjustments, corrections, payroll, and asset depreciation logs.</p>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && canEditOrDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBulkConfirm(true)}
              className="gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </Button>
          )}
          {canPostToLedger && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              <span>New Journal Entry</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Transaction Books</CardTitle>
              <CardDescription>Double-entry balancing ledger vouchers.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search journals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-1.5 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-600/60 transition-all placeholder-slate-500"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono self-end sm:self-auto">
                <Calendar className="h-4 w-4" />
                <span>Current Term</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
        <MobileOnly className="p-3 space-y-2">
          {filteredJournals.length === 0 ? (
            <p className="py-8 text-center text-slate-500 italic text-sm">No journals found.</p>
          ) : filteredJournals.map((je) => {
            const debitTotal = je.lines.reduce((s, r) => s + r.debit, 0);
            const creditTotal = je.lines.reduce((s, r) => s + r.credit, 0);
            const isExpanded = expandedJeId === je.id;
            return (
              <div key={je.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 overflow-hidden">
                <button type="button" onClick={() => toggleExpand(je.id)} className="w-full text-left p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono font-bold text-brand-400 text-xs">{je.voucherNo}</span>
                    {getStatusBadge(je.status)}
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mb-1">{je.reference}</p>
                  <p className="text-xs text-slate-400 mb-2 truncate">{je.description || ''}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-2">
                    <span>{je.postingDate}</span>
                    <Badge variant="brand">{je.subsidiary}</Badge>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-emerald-400">DR PKR {debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">CR PKR {creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-800/60 p-3 space-y-2 bg-slate-950/60">
                    {je.lines.map((line, idx) => (
                      <div key={idx} className="text-[11px] grid grid-cols-2 gap-1">
                        <span className="font-mono text-slate-300">{line.accountCode}</span>
                        <span className="text-right font-mono text-emerald-400">{line.debit > 0 ? `Rs ${line.debit.toFixed(2)}` : line.credit > 0 ? `(Rs ${line.credit.toFixed(2)})` : '—'}</span>
                        {line.description && <span className="col-span-2 text-slate-500 truncate">{line.description}</span>}
                      </div>
                    ))}
                    {(je.status === 'Draft' || canEditOrDelete) && (
                      <div className="flex gap-2 pt-2 border-t border-slate-800/60 mt-2">
                        {je.status === 'Draft' && canPostToLedger && (
                          <>
                            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleUpdateStatus(je.dbId, 'Cancelled')}>Cancel Draft</Button>
                            <Button size="sm" variant="primary" className="flex-1 text-xs" onClick={() => handleUpdateStatus(je.dbId, 'Posted')}>Post Now</Button>
                          </>
                        )}
                        {canEditOrDelete && (
                          <Button size="sm" variant="danger" className="text-xs px-2" onClick={() => handleDeleteJournal(je.dbId || je.id, je.voucherNo)}>Delete</Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                {canEditOrDelete && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredJournals.length > 0 && selectedIds.length === filteredJournals.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </th>
                )}
                <th className="py-3 px-4 w-12 text-center"></th>
                <th className="py-3 px-4 w-28">Voucher No</th>
                <th className="py-3 px-4 w-32">Post Date</th>
                <th className="py-3 px-4 w-40">Entity/Subsidiary</th>
                <th className="py-3 px-4">Reference/Memo</th>
                <th className="py-3 px-4 w-32 text-right">Debit Total</th>
                <th className="py-3 px-4 w-32 text-right">Credit Total</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-800/40">
              {filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={canEditOrDelete ? "9" : "8"} className="py-8 text-center text-slate-500 italic">
                    No journals found for the selected entity.
                  </td>
                </tr>
              ) : (
                filteredJournals.map((je) => {
                  const isExpanded = expandedJeId === je.id;
                  
                  const debitTotal = je.lines.reduce((s, r) => s + r.debit, 0);
                  const creditTotal = je.lines.reduce((s, r) => s + r.credit, 0);

                  return (
                    <Fragment key={je.id}>
                      <tr 
                        className={`hover:bg-slate-900/20 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900/15' : ''}`}
                        onClick={() => toggleExpand(je.id)}
                      >
                        {canEditOrDelete && (
                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(je.dbId || je.id)}
                              onChange={(e) => handleSelectOne(je.dbId || je.id, e)}
                              className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                            />
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-center">
                          <button className="text-slate-500 cursor-pointer">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-brand-400">{je.voucherNo}</td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">{je.postingDate}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant="brand">{je.subsidiary}</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-200 font-semibold truncate max-w-[200px]" title={je.description}>
                          {je.reference} {je.description && <span className="text-slate-500 font-normal ml-1">- {je.description}</span>}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                          PKR {debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-300">
                          PKR {creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(je.status)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={canEditOrDelete ? "9" : "8"} className="bg-slate-950/50 p-4 border-l-2 border-brand-500">
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                  <FileSpreadsheet className="h-3.5 w-3.5 text-brand-400" />
                                  <span>Voucher Double-Entry Balancing Sheet ({je.voucherNo})</span>
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-slate-500">Posted by: <span className="font-semibold text-slate-400">{je.postedBy}</span></span>
                                  {(je.status === 'Draft' || canEditOrDelete) && (
                                    <div className="flex gap-2 ml-4 border-l border-slate-800 pl-4">
                                      {je.status === 'Draft' && canPostToLedger && (
                                        <>
                                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleUpdateStatus(je.dbId, 'Cancelled')}>
                                            <X className="h-3 w-3" /> Cancel
                                          </Button>
                                          <Button size="sm" variant="primary" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleUpdateStatus(je.dbId, 'Posted')}>
                                            <Check className="h-3 w-3" /> Post
                                          </Button>
                                        </>
                                      )}
                                      {canEditOrDelete && (
                                        <Button size="sm" variant="danger" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleDeleteJournal(je.dbId || je.id, je.voucherNo)}>
                                          <Trash2 className="h-3 w-3" /> Delete
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="border border-slate-800/80 rounded-lg overflow-hidden overflow-x-auto bg-slate-950">
                                <table className="w-full text-left border-collapse min-w-[500px]">
                                  <thead>
                                    <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase bg-slate-900/25">
                                      <th className="py-2 px-3 w-40">GL Account</th>
                                      <th className="py-2 px-3">Description / Memo</th>
                                      <th className="py-2 px-3 w-28 text-right">Debit (Rs)</th>
                                      <th className="py-2 px-3 w-28 text-right">Credit (Rs)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {je.lines.map((line, idx) => (
                                      <tr key={idx} className="hover:bg-slate-900/10 text-xs">
                                        <td className="py-2 px-3 font-mono font-bold text-slate-300">
                                          {line.accountCode}
                                        </td>
                                        <td className="py-2 px-3 text-slate-400">
                                          {line.description || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                          {line.debit > 0 ? `Rs ${line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-red-400">
                                          {line.credit > 0 ? `Rs ${line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-slate-900/10 font-bold border-t border-slate-800">
                                      <td className="py-2 px-3">Total Voucher</td>
                                      <td className="py-2 px-3"></td>
                                      <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                        PKR {debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                                        PKR {creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </DesktopOnly>
        </CardContent>
      </Card>

      <JournalEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Bulk Deletion</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-white">{selectedIds.length}</span> selected journal entry(s)? Account balances will be automatically re-adjusted. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedIds.length} Entry(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
