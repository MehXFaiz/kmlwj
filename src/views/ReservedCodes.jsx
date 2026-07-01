import { useState, useEffect, useMemo } from 'react';
import { useReservedCodeStore } from '../store/reservedCodeStore';
import {
  ShieldBan, Search, Plus, ChevronDown, ChevronUp, X, AlertTriangle,
  Lock, Hash, Edit2, Trash2, Download, Layers, CheckCircle2, Copy, Info,
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass, statGridClass } from '../components/common/responsive';

/* ─── Stat Card ─── */
function StatCard({ title, value, icon: Icon, iconBg, iconColor, sub, delay = 0 }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5 flex items-start justify-between gap-3 hover:border-slate-700 transition-all duration-300"
      style={{ animation: `fadeUp 0.5s ease ${delay}ms both` }}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">{title}</p>
        <p className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} border border-white/5`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  true: { badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50', dot: 'bg-emerald-400', label: 'Active' },
  false: { badge: 'bg-slate-800/60 text-slate-400 border-slate-700/50', dot: 'bg-slate-500', label: 'Inactive' },
};

/* ─── Modal ─── */
function ReservedCodeModal({ isOpen, onClose, onSave, initial, apiError }) {
  const [form, setForm] = useState(
    initial || { reserveStart: '', reserveEnd: '', reserveReason: '', isActive: true }
  );

  useEffect(() => {
    if (initial) setForm(initial);
    else setForm({ reserveStart: '', reserveEnd: '', reserveReason: '', isActive: true });
  }, [initial, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.reserveStart.trim() || !form.reserveEnd.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center">
              <Hash className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Reserved Code' : 'Reserve New Code Range'}</h3>
              <p className="text-[11px] text-slate-500">Prevent GL codes from being assigned to regular accounts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {apiError && (
            <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{apiError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Start Code *</label>
              <input value={form.reserveStart} onChange={e => setForm(f => ({ ...f, reserveStart: e.target.value }))} placeholder="e.g. 8000"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">End Code *</label>
              <input value={form.reserveEnd} onChange={e => setForm(f => ({ ...f, reserveEnd: e.target.value }))} placeholder="e.g. 8999"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Reason *</label>
            <textarea value={form.reserveReason} onChange={e => setForm(f => ({ ...f, reserveReason: e.target.value }))} rows={2}
              placeholder="Why is this code range being reserved..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all resize-none" />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-600 focus:ring-amber-600/50" />
              <span className="text-sm font-semibold text-slate-300">Is Active?</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.reserveStart.trim() || !form.reserveEnd.trim() || !form.reserveReason.trim()}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-amber-900/40">
            {initial ? 'Save Changes' : 'Reserve Code Range'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export const ReservedCodes = () => {
  const { codes, fetchCodes, addCode, updateCode, deleteCode, error } = useReservedCodeStore();
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortField, setSortField] = useState('reserveStart');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const stats = useMemo(() => ({
    total: codes.length,
    active: codes.filter(c => c.isActive).length,
    inactive: codes.filter(c => !c.isActive).length,
  }), [codes]);

  const filtered = useMemo(() => {
    let list = [...codes];
    if (search) list = list.filter(c =>
      c.reserveStart.includes(search) ||
      c.reserveEnd.includes(search) ||
      (c.reserveReason || '').toLowerCase().includes(search.toLowerCase())
    );
    if (filterStatus !== 'All') list = list.filter(c => c.isActive === (filterStatus === 'Active'));
    list.sort((a, b) => {
      const av = a[sortField] ?? ''; const bv = b[sortField] ?? '';
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [codes, search, filterStatus, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const allIds = filtered.map(c => c.id);
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleAll = () => isAllSelected ? setSelectedIds([]) : setSelectedIds(allIds);
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const handleSave = async (data) => {
    setApiError(null);
    try {
      if (editItem) {
        await updateCode(editItem.id, data);
      } else {
        await addCode(data);
      }
      setModalOpen(false);
      setEditItem(null);
    } catch (err) {
      setApiError(err.response?.data?.error?.message || err.message || "Failed to save reserved code");
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await deleteCode(id);
      setSelectedIds(p => p.filter(i => i !== id));
      setDeleteId(null);
    } catch (err) {
      console.error(err);
    }
    setIsDeleting(false);
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await Promise.all(selectedIds.map(id => deleteCode(id)));
      setSelectedIds([]);
      setShowBulkConfirm(false);
    } catch (err) {
      alert("Failed to delete some items");
    }
    setIsDeleting(false);
  };

  const SortIcon = ({ field }) => (
    sortField === field
      ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-400 ml-1" /> : <ChevronDown className="h-3 w-3 text-amber-400 ml-1" />)
      : <ChevronDown className="h-3 w-3 text-slate-700 ml-1" />
  );

  const detailItem = detailId ? codes.find(c => c.id === detailId) : null;

  return (
    <div className="space-y-6 pb-10">
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;}}`}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded-full">
              <ShieldBan className="h-3 w-3" /> Code Governance
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Reserved Codes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage restricted GL code ranges and system-protected account blocks</p>
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
          <button onClick={() => { setEditItem(null); setModalOpen(true); setApiError(null); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Reserve Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Reservations" value={stats.total} icon={Hash} iconBg="bg-amber-950/60" iconColor="text-amber-400" delay={0} />
        <StatCard title="Active Reservations" value={stats.active} icon={Lock} iconBg="bg-emerald-950/60" iconColor="text-emerald-400" delay={80} />
        <StatCard title="Inactive Reservations" value={stats.inactive} icon={Layers} iconBg="bg-slate-800/60" iconColor="text-slate-400" delay={160} />
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border border-indigo-900/30 bg-indigo-950/10 px-4 sm:px-5 py-3.5 flex items-start gap-3">
        <Info className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-indigo-300">Why Reserve GL Codes?</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Reserved code ranges prevent accidental creation of accounts in protected GL segments. Once a range is reserved, no new accounts can be created within that code block.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reason or code..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-600/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none transition-all">
          {['All', 'Active', 'Inactive'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <MobileOnly className="p-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-sm">No reserved codes match your filters.</p>
          ) : filtered.map((c, i) => {
            const sc = STATUS_COLORS[c.isActive] || STATUS_COLORS[false];
            return (
              <div key={c.id} className={`rounded-lg border bg-slate-950/40 p-3 transition-colors ${selectedIds.includes(c.id) ? 'border-amber-600/50 bg-amber-900/10' : 'border-slate-800/60'}`} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <div className="flex items-start gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-400">{c.reserveStart} - {c.reserveEnd}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 mb-2">{c.reserveReason}</p>
                <div className="flex items-center gap-1 pt-2 border-t border-slate-800/50">
                  <button onClick={() => setDetailId(c.id)} className="flex-1 py-2 rounded-lg bg-slate-800/60 text-slate-400 text-xs font-semibold">Details</button>
                  <button onClick={() => { setEditItem(c); setModalOpen(true); setApiError(null); }} className="flex-1 py-2 rounded-lg bg-slate-800/60 text-slate-400 text-xs font-semibold">Edit</button>
                  <button onClick={() => setDeleteId(c.id)} className="flex-1 py-2 rounded-lg bg-red-950/30 text-red-400 text-xs font-semibold">Remove</button>
                </div>
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer"
                  />
                </th>
                {[
                  { label: 'Start Code', field: 'reserveStart', w: 'w-32' },
                  { label: 'End Code', field: 'reserveEnd', w: 'w-32' },
                  { label: 'Reason', field: 'reserveReason' },
                  { label: 'Status', field: 'isActive', w: 'w-28' },
                  { label: 'Created At', field: 'createdAt', w: 'w-36' },
                  { label: '', w: 'w-24' },
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
                <tr><td colSpan={6} className="py-16 text-center text-slate-500 text-sm">No reserved codes match your filters.</td></tr>
              ) : filtered.map((c, i) => {
                const sc = STATUS_COLORS[c.isActive] || STATUS_COLORS[false];
                return (
                  <tr key={c.id} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                    className={`hover:bg-slate-800/20 transition-colors group ${selectedIds.includes(c.id) ? 'bg-amber-900/10' : ''}`}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-600 focus:ring-amber-600 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5"><span className="font-mono text-xs font-bold text-amber-400">{c.reserveStart}</span></td>
                    <td className="px-4 py-3.5"><span className="font-mono text-xs font-bold text-amber-400">{c.reserveEnd}</span></td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-200 line-clamp-1">{c.reserveReason}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailId(c.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setEditItem(c); setModalOpen(true); setApiError(null); }}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(c.id)}
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
      </div>

      {/* Detail Panel */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetailId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-200">Reserved Code Details</h3>
              <button onClick={() => setDetailId(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                ['Start Code', detailItem.reserveStart],
                ['End Code', detailItem.reserveEnd],
                ['Reason', detailItem.reserveReason],
                ['Created At', new Date(detailItem.createdAt).toLocaleString()],
                ['Status', detailItem.isActive ? 'Active' : 'Inactive'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-slate-800/50 pb-2 last:border-0">
                  <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                  <span className="text-[11px] text-slate-300 font-semibold text-right max-w-[60%]">{val || '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailId(null)}
              className="w-full mt-5 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">
              Close
            </button>
          </div>
        </div>
      )}

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
                <h4 className="text-sm font-bold text-slate-200">Remove Reservation</h4>
                <p className="text-xs text-slate-500">This will unreserve the GL code range.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
                {isDeleting ? 'Removing...' : 'Remove'}
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
                <h4 className="text-sm font-bold text-slate-200">Bulk Remove Reservations</h4>
                <p className="text-xs text-slate-500">Remove {selectedIds.length} items? This will unreserve the GL code ranges.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-all">
                {isDeleting ? 'Removing...' : 'Remove All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReservedCodeModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); setApiError(null); }}
        onSave={handleSave} initial={editItem} apiError={apiError} />
    </div>
  );
};
