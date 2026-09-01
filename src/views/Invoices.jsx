import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useInvoiceStore } from '../store/invoiceStore';
import { useAuthStore } from '../store/authStore';
import { FileSpreadsheet, Search, Plus, Edit2, Trash2, ChevronRight, Eye, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

export const Invoices = () => {
  const navigate = useNavigate();
  const { invoices, fetchInvoices, deleteInvoice, bulkDeleteInvoices } = useInvoiceStore();
  const { canEditOrDelete } = useAuthStore();
  
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, DRAFT, POSTED, PAID, CANCELLED
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = 
        (inv.invoiceNo || '').toLowerCase().includes(search.toLowerCase()) || 
        (inv.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.remarks || '').toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await deleteInvoice(id);
      showToast('Invoice deleted successfully', 'success');
      setDeleteId(null);
    } catch (err) {
      handleDeleteError(err, 'Failed to delete invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(inv => inv.id));
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
      await bulkDeleteInvoices(selectedIds);
      showToast(`${selectedIds.length} invoice(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      handleDeleteError(err, 'Failed to bulk delete invoices');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Draft</span>;
      case 'POSTED':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/60 text-amber-400 border-amber-900/50">Posted</span>;
      case 'PAID':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Paid</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">Cancelled</span>;
      default:
        return null;
    }
  };

  const tabs = [
    { label: 'All Bills', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Posted', value: 'POSTED' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Cancelled', value: 'CANCELLED' }
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="h-3 w-3" /> Sales Invoices
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Invoices</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer billing documentation and general ledger postings</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-lg active:scale-95 flex-1 sm:flex-none cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          <Link to="/invoices/new"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 scrollbar-none overflow-x-auto whitespace-nowrap">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-3 text-xs font-bold transition-all relative cursor-pointer border-b-2 -mb-[2px] ${statusFilter === tab.value ? 'text-amber-400 border-amber-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice #, customer name, memo..."
            name="invoice-search" autoComplete="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-650 focus:outline-none focus:border-amber-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Invoice No</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Customer</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Dates</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Total Amount</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(inv.id)}
                        onChange={(e) => handleSelectOne(inv.id, e)}
                        className="rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-slate-350 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/40">
                        {inv.invoiceNo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-200">{inv.customer?.name || 'Unknown'}</p>
                      {inv.remarks && <p className="text-[11px] text-slate-500 truncate max-w-44 mt-0.5">{inv.remarks}</p>}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <p className="text-xs text-slate-300">Issued: {formatDateDDMMYYYY(inv.issueDate)}</p>
                      <p className="text-[10px] text-slate-500">Due: {formatDateDDMMYYYY(inv.dueDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-250">
                        PKR {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/invoices/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-250" title="View details"><Eye className="h-3.5 w-3.5" /></button>
                        {(inv.status === 'DRAFT' || canEditOrDelete) && (
                          <>
                            <button onClick={() => navigate(`/invoices/edit/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-250" title="Edit invoice"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleteId(inv.id)} className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400" title="Delete invoice"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500 text-sm">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(inv => (
              <div key={inv.id} className="rounded-lg border bg-slate-950/40 p-3 transition-colors border-slate-800/60" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-350">{inv.invoiceNo}</span>
                    <h4 className="text-sm font-bold text-slate-200 mt-1">{inv.customer?.name}</h4>
                  </div>
                  {getStatusBadge(inv.status)}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                  <div className="text-[11px] text-slate-500">
                    Total: <span className="text-xs font-bold text-slate-300">PKR {inv.total.toLocaleString()}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-550" />
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                No invoices found.
              </div>
            )}
        </MobileOnly>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Confirm Delete</h4>
            <p className="text-xs text-slate-500 mb-4">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              Are you sure you want to delete <span className="font-bold text-white">{selectedIds.length}</span> selected invoice(s)? Any associated ledger entries will be removed/reversed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedIds.length} Invoice(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
