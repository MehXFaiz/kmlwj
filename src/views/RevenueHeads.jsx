import { useState, useEffect, useMemo } from 'react';
import { useRevenueStore } from '../store/revenueStore';
import { useCoaStore } from '../store/coaStore';
import {
  TrendingUp, Search, Plus, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Edit2, Trash2,
  ArrowUpRight, Download, X, AlertTriangle, Layers
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';

/* ─── Add / Edit Modal ─── */
function RevenueHeadModal({ isOpen, onClose, onSave, initial, accounts }) {
  const [form, setForm] = useState(
    initial || { name: '', category: 'Hall Bookings', hall: '', amount: 0, accountId: '', isActive: true }
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial || { name: '', category: 'Hall Bookings', hall: '', amount: 0, accountId: '', isActive: true });
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'warning');
      return;
    }
    if (!/^[a-zA-Z0-9\s.-]{3,50}$/.test(form.name)) {
      showToast('Name should only contain letters, numbers, spaces, hyphens, and dots (3-50 chars)', 'warning');
      return;
    }
    if (!form.category.trim()) {
      showToast('Category is required', 'warning');
      return;
    }
    onSave({ ...form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Revenue Head' : 'New Revenue Head'}</h3>
              <p className="text-[11px] text-slate-500">Define a revenue classification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Zakat"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-600/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (PKR)</label>
              <input
                type="number"
                value={form.amount || ''}
                onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-600/30 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category *</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value, hall: e.target.value === 'Hall Bookings' ? '' : f.hall }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/60 transition-all"
              >
                {['Hall Bookings', 'Other Income'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Linked Account ID</label>
              <select
                value={form.accountId || ''}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/60 transition-all"
              >
                <option value="">No Linked Account (Optional)</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {form.category === 'Hall Bookings' && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Hall Name</label>
                <select
                  value={form.hall || ''}
                  onChange={e => setForm(f => ({ ...f, hall: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/60 transition-all"
                >
                  <option value="">Select a hall...</option>
                  <option value="Bagh-e-Hajiani Garden">Bagh-e-Hajiani Garden</option>
                  <option value="Sadaya Hall">Sadaya Hall</option>
                  <option value="Zikarya Hall">Zikarya Hall</option>
                  <option value="Annexy Hall">Annexy Hall</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-slate-900 transition-all cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300 cursor-pointer">
              Active Stream
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || !form.category.trim()}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-emerald-900/40"
          >
            {initial ? 'Save Changes' : 'Create Revenue Head'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  true: { badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50', dot: 'bg-emerald-400', label: 'Active' },
  false: { badge: 'bg-slate-800/60 text-slate-400 border-slate-700/50', dot: 'bg-slate-500', label: 'Inactive' },
};

const CAT_COLORS = {
  'Hall Bookings': 'bg-blue-950/50 text-blue-400 border-blue-900/40',
  'Other Income': 'bg-violet-950/50 text-violet-400 border-violet-900/40',
  'Other': 'bg-slate-800/50 text-slate-400 border-slate-700/40',
};

/* ─── View Modal ─── */
function RevenueHeadViewModal({ isOpen, onClose, item }) {
  if (!isOpen || !item) return null;
  const sc = STATUS_COLORS[item.isActive] || STATUS_COLORS.false;
  const cc = CAT_COLORS[item.category] || CAT_COLORS.Other;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-700/50 bg-slate-900/95 shadow-2xl shadow-black/50 max-h-[92dvh] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-6 py-5 border-b border-slate-800/60 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-blue-900/50 to-slate-900 border border-blue-800/30 shadow-inner">
              <Layers className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 tracking-tight">Revenue Head Details</h3>
              <p className="text-xs text-slate-400">View classification information</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          
          {/* Hero Section */}
          <div className="space-y-4">
             <h4 className="text-3xl font-extrabold text-white tracking-tight">{item.name}</h4>
             <div className="flex flex-wrap gap-2.5">
                 <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${cc} shadow-sm`}>
                    {item.category}
                 </span>
                 {item.hall && (
                   <span className={`px-2.5 py-1 text-xs font-bold rounded-md border bg-indigo-950/40 text-indigo-300 border-indigo-900/50 shadow-sm`}>
                     {item.hall}
                   </span>
                 )}
                 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md border ${sc.badge} shadow-sm`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                 </span>
             </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Amount</span>
               <span className="font-mono text-emerald-400 text-lg font-medium">
                 {item.amount > 0 ? `PKR ${item.amount.toLocaleString()}` : '—'}
               </span>
             </div>
             
             <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Linked Account</span>
               <span className="font-mono text-slate-200 text-sm truncate" title={item.accountId}>
                 {item.accountId || <span className="text-slate-500 italic">Unlinked</span>}
               </span>
             </div>
             
             <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Created At</span>
               <span className="text-slate-300 text-sm font-medium">
                 {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
               </span>
             </div>
             
             <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Updated</span>
               <span className="text-slate-300 text-sm font-medium">
                 {new Date(item.updatedAt || item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
               </span>
             </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-800/60 bg-slate-900/50 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700 hover:text-white text-slate-300 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-slate-600 shadow-sm">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export const RevenueHeads = () => {
  const { heads, fetchHeads, addHead, updateHead, deleteHead } = useRevenueStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchHeads();
    fetchAccountsList();
  }, [fetchHeads, fetchAccountsList]);

  const categories = useMemo(() => ['All', ...new Set(heads.map(h => h.category))], [heads]);

  const filtered = useMemo(() => {
    let list = [...heads];
    if (search) list = list.filter(h =>
      (h.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.category && h.category.toLowerCase().includes(search.toLowerCase()))
    );
    if (filterStatus !== 'All') {
      const isActive = filterStatus === 'Active';
      list = list.filter(h => h.isActive === isActive);
    }
    if (filterCat !== 'All') list = list.filter(h => h.category === filterCat);
    list.sort((a, b) => {
      const av = a[sortField] ?? ''; const bv = b[sortField] ?? '';
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [heads, search, filterStatus, filterCat, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const allIds = filtered.map(h => h.id);
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleAll = () => isAllSelected ? setSelectedIds([]) : setSelectedIds(allIds);
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const handleSave = async (data) => {
    try {
      if (editItem) {
        await updateHead(editItem.id, data);
      } else {
        await addHead(data);
      }
      setEditItem(null);
      setModalOpen(false);
      showToast(editItem ? 'Revenue head updated successfully' : 'Revenue head created successfully', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || 'Failed to save. Please ensure inputs are correct.', 'error');
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await deleteHead(id);
      showToast('Revenue head deleted successfully', 'success');
      setSelectedIds(p => p.filter(i => i !== id));
      setDeleteId(null);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || 'Error deleting revenue head', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    
    const results = await Promise.allSettled(
      selectedIds.map(async (id) => {
        await deleteHead(id);
        return id;
      })
    );

    const successfulIds = [];
    const failedIds = [];
    let lastError = null;

    results.forEach((result, idx) => {
      const id = selectedIds[idx];
      if (result.status === 'fulfilled') {
        successfulIds.push(id);
      } else {
        failedIds.push(id);
        lastError = result.reason;
      }
    });

    setSelectedIds(failedIds);
    setShowBulkConfirm(false);

    if (successfulIds.length > 0 && failedIds.length === 0) {
      showToast(`${successfulIds.length} revenue heads removed successfully.`, 'success');
    } else if (successfulIds.length > 0 && failedIds.length > 0) {
      const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || 'associated records';
      showToast(`Removed ${successfulIds.length} head(s). ${failedIds.length} head(s) could not be removed: ${errorMsg}`, 'warning');
    } else if (failedIds.length > 0) {
      const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Some records could not be removed.';
      showToast(errorMsg, 'error');
    }

    setIsDeleting(false);
  };

  const SortIcon = ({ field }) => (
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-emerald-400 ml-1" /> : <ChevronDown className="h-3 w-3 text-emerald-400 ml-1" />)
      : <ChevronDown className="h-3 w-3 text-slate-700 ml-1" />
  );

  return (
    <div className="space-y-6 pb-10">
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;}}`}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400 bg-emerald-950/50 border border-emerald-900/60 px-2.5 py-0.5 rounded-full">
              <TrendingUp className="h-3 w-3" /> Revenue Master Data
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Revenue Heads</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage revenue streams and classifications</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-900/50 transition-all text-xs font-semibold flex-1 sm:flex-none"
            >
              <Trash2 className="h-3.5 w-3.5" /> Bulk Delete ({selectedIds.length})
            </button>
          )}
          <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4" /> New Revenue Head
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search revenue heads..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-600/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-emerald-600/50 transition-all">
          {['All', 'Active', 'Inactive'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-emerald-600/50 transition-all">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <MobileOnly className="p-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">
              No revenue heads found. <button onClick={() => setModalOpen(true)} className="text-emerald-400 hover:underline ml-1">Add one?</button>
            </p>
          ) : filtered.map((h, i) => {
            const sc = STATUS_COLORS[h.isActive] || STATUS_COLORS.false;
            const cc = CAT_COLORS[h.category] || CAT_COLORS.Other;
            return (
              <div key={h.id} className={`rounded-lg border bg-slate-950/40 p-3 transition-colors ${selectedIds.includes(h.id) ? 'border-emerald-600/50 bg-emerald-900/10' : 'border-slate-800/60'}`} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <div className="flex items-start gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(h.id)}
                    onChange={() => toggleSelect(h.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <p 
                      className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors"
                      onClick={() => setViewItem(h)}
                    >
                      {h.name}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
                  {h.amount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/50 text-emerald-400 border-emerald-900/40">PKR {h.amount.toLocaleString()}</span>}
                </div>
                {h.accountId && (
                  <div className="text-[11px] mb-3">
                    <span className="text-slate-500 block">Linked Account</span>
                    <span className="font-mono text-slate-400">{h.accountId}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 pt-2 border-t border-slate-800/50">
                  <button onClick={() => { setEditItem(h); setModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-semibold">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => setDeleteId(h.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-950/30 text-red-400 hover:bg-red-950/50 text-xs font-semibold">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                </th>
                {[
                  { label: 'Name', field: 'name' },
                  { label: 'Category', field: 'category', w: 'w-48' },
                  { label: 'Amount', field: 'amount', w: 'w-32' },
                  { label: 'Account ID', field: 'accountId', w: 'w-48' },
                  { label: 'Status', field: 'isActive', w: 'w-28' },
                  { label: 'Created', field: 'createdAt', w: 'w-36' },
                  { label: '', w: 'w-20' },
                ].map(col => (
                  <th key={col.label}
                    onClick={() => col.field && toggleSort(col.field)}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${col.field ? 'cursor-pointer hover:text-slate-300' : ''} ${col.w || ''}`}>
                    <span className="flex items-center">
                      {col.label}
                      {col.field && <SortIcon field={col.field} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                    No revenue heads found. <button onClick={() => setModalOpen(true)} className="text-emerald-400 hover:underline ml-1">Add one?</button>
                  </td>
                </tr>
              ) : filtered.map((h, i) => {
                const sc = STATUS_COLORS[h.isActive] || STATUS_COLORS.false;
                const cc = CAT_COLORS[h.category] || CAT_COLORS.Other;
                return (
                  <tr key={h.id}
                    style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                    className={`hover:bg-slate-800/20 transition-colors group ${selectedIds.includes(h.id) ? 'bg-emerald-900/10' : ''}`}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(h.id)}
                        onChange={() => toggleSelect(h.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <p 
                        className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors inline-block"
                        onClick={() => setViewItem(h)}
                      >
                        {h.name}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-emerald-400 text-sm">
                      {h.amount > 0 ? `PKR ${h.amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400 truncate max-w-[12rem]">
                      {h.accountId || <span className="text-slate-600 italic">Unlinked</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(h); setModalOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(h.id)}
                          className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </DesktopOnly>
        <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Showing {filtered.length} of {heads.length} revenue heads</span>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-950/60 border border-red-800/40 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">Delete Revenue Head</h4>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBulkConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-950/60 border border-red-800/40 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">Bulk Delete Revenue Heads</h4>
                <p className="text-xs text-slate-500">Delete {selectedIds.length} items? This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
                {isDeleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RevenueHeadModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave}
        initial={editItem}
        accounts={flatAccounts}
      />
      <RevenueHeadViewModal
        isOpen={!!viewItem}
        onClose={() => setViewItem(null)}
        item={viewItem}
      />
    </div>
  );
};
