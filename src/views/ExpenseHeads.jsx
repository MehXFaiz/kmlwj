import { useState, useEffect, useMemo } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import {
  TrendingDown, Search, Plus, ChevronDown, ChevronUp,
  CheckCircle2, Edit2, Trash2, Download, X, AlertTriangle, Layers,
  Tag,
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass, statGridClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { handleDeleteError } from '../utils/deleteHandler';

const EXPENSE_CATEGORIES = [
  'Salaries & Benefits',
  'Rent, Rates & Taxes',
  'Fuel & Power',
  'Repair & Maintenance',
  'Computer Expenses',
  'Printing & Stationery',
  'Donations',
  'Legal & Professional',
  'Audit Expenses',
  'Travelling & Conveyance',
  'General Office Expenses',
  'Reception, Meetings & Functions',
  'Security Expenses',
  'Subscription Expenses',
  'Other Expenses',
  'Financial Charges',
];

/* ─── Stat Card ─── */
function StatCard({ title, value, prefix = '', icon: Icon, iconBg, iconColor, sub, delay = 0 }) {
  return (
    <div
      className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 flex items-start justify-between gap-3 hover:border-slate-700 transition-all duration-300"
      style={{ animation: `fadeUp 0.5s ease ${delay}ms both` }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">{title}</p>
        <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} border border-white/5`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

// Replace null DB values with '' so controlled inputs stay controlled
const nullsToEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? '' : v]));

const DEFAULT_EXPENSE_HEAD = { name: '', category: 'Salaries & Benefits', accountId: '', isActive: true };

/* ─── Modal ─── */
function ExpenseHeadModal({ isOpen, onClose, onSave, initial, accounts }) {
  const [form, setForm] = useState(
    initial ? nullsToEmpty(initial) : DEFAULT_EXPENSE_HEAD
  );
  
  useEffect(() => {
    if (initial) setForm(nullsToEmpty(initial));
    else setForm(DEFAULT_EXPENSE_HEAD);
  }, [initial, isOpen]);

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
    onSave({ ...form });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-950/60 border border-red-800/40 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Expense Head' : 'New Expense Head'}</h3>
              <p className="text-[11px] text-slate-500">Define an expense classification account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Expense Head Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Executive Salaries"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-600/50 transition-all font-medium" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-red-600/50 transition-all font-medium">
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Linked Account (Optional)</label>
            <select value={form.accountId || ''} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-red-600/50 transition-all font-medium">
              <option value="">-- None --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-red-600 focus:ring-red-600/50" />
              <span className="text-sm font-semibold text-slate-300">Is Active?</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-red-900/40 active:scale-95">
            {initial ? 'Save Changes' : 'Create Expense Head'}
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

export const ExpenseHeads = () => {
  const { heads, fetchHeads, addHead, updateHead, deleteHead } = useExpenseStore();
  const canEditOrDelete = useAuthStore((s) => s.canEditOrDelete);
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchHeads();
    fetchAccountsList(); // Fetch accounts for dropdown
  }, [fetchHeads, fetchAccountsList]);

  const stats = useMemo(() => ({
    total: heads.length,
    active: heads.filter(h => h.isActive).length,
    inactive: heads.filter(h => !h.isActive).length,
  }), [heads]);

  const categories = useMemo(() => ['All', ...EXPENSE_CATEGORIES], []);

  const filtered = useMemo(() => {
    let list = [...heads];
    if (search) list = list.filter(h => (h.name || '').toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'All') list = list.filter(h => h.isActive === (filterStatus === 'Active'));
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
      showToast(editItem ? 'Expense head updated successfully' : 'Expense head created successfully', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || 'Failed to save. Please ensure inputs are correct.', 'error');
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await deleteHead(id);
      showToast('Expense head deleted successfully', 'success');
      setSelectedIds(p => p.filter(i => i !== id));
      setDeleteId(null);
    } catch (err) {
      handleDeleteError(err, 'Error deleting expense head');
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
      showToast(`${successfulIds.length} expense heads removed successfully.`, 'success');
    } else if (successfulIds.length > 0 && failedIds.length > 0) {
      const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || 'associated records';
      showToast(`Removed ${successfulIds.length} head(s). ${failedIds.length} head(s) could not be removed: ${errorMsg}`, 'warning');
    } else if (failedIds.length > 0) {
      handleDeleteError(lastError, 'Failed to delete expense heads.');
    }

    setIsDeleting(false);
  };

  const SortIcon = ({ field }) => (
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-red-400 ml-1" /> : <ChevronDown className="h-3 w-3 text-red-400 ml-1" />)
      : <ChevronDown className="h-3 w-3 text-slate-700 ml-1" />
  );

  return (
    <div className="space-y-6 pb-10">
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;}}`}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-400 bg-red-950/50 border border-red-900/60 px-2.5 py-0.5 rounded-full">
              <TrendingDown className="h-3 w-3" /> Master Module
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Expense Heads</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage and categorize company expense accounts</p>
        </div>
        <div className={pageActionsClass}>
          {canEditOrDelete && selectedIds.length > 0 && (
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
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> New Expense Head
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Expense Heads" value={stats.total} icon={Layers} iconBg="bg-red-950/60" iconColor="text-red-400" delay={0} />
        <StatCard title="Active Heads" value={stats.active} icon={CheckCircle2} iconBg="bg-emerald-950/60" iconColor="text-emerald-400" delay={80} />
        <StatCard title="Inactive Heads" value={stats.inactive} icon={X} iconBg="bg-slate-800/60" iconColor="text-slate-400" delay={160} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-600/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-red-600/50 transition-all">
          {['All', 'Active', 'Inactive'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-red-600/50 transition-all">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <MobileOnly className="p-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">No expense heads found. <button onClick={() => setModalOpen(true)} className="text-red-400 hover:underline ml-1">Add one?</button></p>
          ) : filtered.map((h, i) => {
            const sc = STATUS_COLORS[h.isActive] || STATUS_COLORS[false];
            return (
              <div key={h.id} className={`rounded-lg border bg-slate-950/40 p-3 transition-colors ${selectedIds.includes(h.id) ? 'border-red-600/50 bg-red-900/10' : 'border-slate-800/60'}`} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <div className="flex items-start gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(h.id)}
                    onChange={() => toggleSelect(h.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-red-600 focus:ring-red-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-200">{h.name}</p>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/50 text-slate-400 border-slate-700/40`}>{h.category}</span>
                  {h.account && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Tag className="h-3 w-3" />{h.account.accountName}</span>}
                </div>
                {canEditOrDelete && (
                  <div className="flex items-center gap-1 pt-2 border-t border-slate-800/50">
                    <button onClick={() => { setEditItem(h); setModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-semibold"><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                    <button onClick={() => setDeleteId(h.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-950/30 text-red-400 text-xs font-semibold"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-red-600 focus:ring-red-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                </th>
                {[
                  { label: 'Expense Head Name', field: 'name' },
                  { label: 'Category', field: 'category', w: 'w-48' },
                  { label: 'Linked Account', w: 'w-64' },
                  { label: 'Status', field: 'isActive', w: 'w-28' },
                  { label: '', w: 'w-20' },
                ].map(col => (
                  <th key={col.label} onClick={() => col.field && toggleSort(col.field)}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${col.field ? 'cursor-pointer hover:text-slate-300' : ''} ${col.w || ''}`}>
                    <span className="flex items-center">{col.label}{col.field && <SortIcon field={col.field} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-500 text-sm">
                  No expense heads found. <button onClick={() => setModalOpen(true)} className="text-red-400 hover:underline ml-1">Add one?</button>
                </td></tr>
              ) : filtered.map((h, i) => {
                const sc = STATUS_COLORS[h.isActive] || STATUS_COLORS[false];
                return (
                  <tr key={h.id} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                    className={`hover:bg-slate-800/20 transition-colors group ${selectedIds.includes(h.id) ? 'bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(h.id)}
                        onChange={() => toggleSelect(h.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-red-600 focus:ring-red-600 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-200">{h.name}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/50 text-slate-400 border-slate-700/40`}>{h.category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        {h.account ? <><Tag className="h-3 w-3" />{h.account.accountName}</> : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {canEditOrDelete && (
                        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditItem(h); setModalOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteId(h.id)}
                            className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </DesktopOnly>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-950/60 border border-red-800/40 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div><h4 className="text-sm font-bold text-slate-200">Delete Expense Head</h4>
                <p className="text-xs text-slate-500">This action cannot be undone.</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
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
                <h4 className="text-sm font-bold text-slate-200">Bulk Delete Expense Heads</h4>
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

      <ExpenseHeadModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave} initial={editItem} accounts={flatAccounts} />
    </div>
  );
};
