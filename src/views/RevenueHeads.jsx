import { useState, useEffect, useMemo } from 'react';
import { useRevenueStore } from '../store/revenueStore';
import { useCoaStore } from '../store/coaStore';
import {
  TrendingUp, Search, Plus, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Edit2, Trash2,
  ArrowUpRight, Download, X, AlertTriangle, Layers
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

/* ─── Add / Edit Modal ─── */
function RevenueHeadModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial || { name: '', category: 'Hall Bookings', accountId: '', isActive: true }
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial || { name: '', category: 'Hall Bookings', accountId: '', isActive: true });
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim() || !form.category.trim()) return;
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
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Zakat"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-600/30 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category *</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/60 transition-all"
              >
                {['Hall Bookings', 'Other Income'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Linked Account ID</label>
              <input
                value={form.accountId || ''}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                placeholder="Optional UUID"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-600/60 transition-all"
              />
            </div>
          </div>

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

export const RevenueHeads = () => {
  const { heads, fetchHeads, addHead, updateHead, deleteHead } = useRevenueStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchHeads();
  }, [fetchHeads]);

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

  const handleSave = async (data) => {
    try {
      if (editItem) {
        await updateHead(editItem.id, data);
      } else {
        await addHead(data);
      }
      setEditItem(null);
      setModalOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message || 'Failed to save. Please ensure inputs are correct (e.g., valid UUID for Linked Account).');
    }
  };

  const handleDelete = async (id) => {
    await deleteHead(id);
    setDeleteId(null);
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
              <div key={h.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3" style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-slate-200">{h.name}</p>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
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
                {[
                  { label: 'Name', field: 'name' },
                  { label: 'Category', field: 'category', w: 'w-48' },
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
                    className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-200">{h.name}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
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
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <RevenueHeadModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave}
        initial={editItem}
      />
    </div>
  );
};
