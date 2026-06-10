import { useState, useMemo } from 'react';
import {
  ShieldBan, Search, Plus, ChevronDown, ChevronUp, X, AlertTriangle,
  Lock, Hash, Edit2, Trash2, Download, Layers, CheckCircle2, Copy, Info,
} from 'lucide-react';

/* ─── Stat Card ─── */
function StatCard({ title, value, icon: Icon, iconBg, iconColor, sub, delay = 0 }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-5 flex items-start justify-between gap-3 hover:border-slate-700 transition-all duration-300"
      style={{ animation: `fadeUp 0.5s ease ${delay}ms both` }}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1.5">{title}</p>
        <p className="text-2xl font-extrabold font-mono text-slate-100">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} border border-white/5`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

/* ─── Default Data ─── */
const defaultReservedCodes = [
  { id: '1', code: '0000', range: '0000-0099', name: 'System Reserved', reason: 'Internal system accounts used for auto-reconciliation', reservedBy: 'System', reservedDate: '2026-01-01', type: 'System', status: 'Locked' },
  { id: '2', code: '1000', range: '1000-1999', name: 'Assets Range', reason: 'Reserved GL code range for all asset-type accounts per GAAP classification', reservedBy: 'System', reservedDate: '2026-01-01', type: 'Category', status: 'Locked' },
  { id: '3', code: '2000', range: '2000-2999', name: 'Liabilities Range', reason: 'Reserved GL code range for all liability accounts', reservedBy: 'System', reservedDate: '2026-01-01', type: 'Category', status: 'Locked' },
  { id: '4', code: '3000', range: '3000-3999', name: 'Equity Range', reason: 'Reserved for equity and retained earnings accounts', reservedBy: 'System', reservedDate: '2026-01-01', type: 'Category', status: 'Locked' },
  { id: '5', code: '4000', range: '4000-4999', name: 'Revenue Range', reason: 'Reserved for operating and non-operating revenue accounts', reservedBy: 'System', reservedDate: '2026-01-01', type: 'Category', status: 'Locked' },
  { id: '6', code: '5000', range: '5000-7999', name: 'Expenses Range', reason: 'Reserved for COGS, operating expenses, interest, and tax accounts', reservedBy: 'System', reservedDate: '2026-01-01', type: 'Category', status: 'Locked' },
  { id: '7', code: '8000', range: '8000-8999', name: 'Other Income/Expense', reason: 'Reserved for extraordinary items and non-recurring transactions', reservedBy: 'admin@acme.com', reservedDate: '2026-03-15', type: 'Custom', status: 'Active' },
  { id: '8', code: '9000', range: '9000-9999', name: 'Statistical Accounts', reason: 'Reserved for statistical and memo accounts (non-posting)', reservedBy: 'admin@acme.com', reservedDate: '2026-02-10', type: 'Custom', status: 'Active' },
  { id: '9', code: '1500', range: '1500-1599', name: 'Intercompany Assets', reason: 'Reserved for intercompany receivables and eliminations', reservedBy: 'admin@acme.com', reservedDate: '2026-04-20', type: 'Custom', status: 'Active' },
  { id: '10', code: '2500', range: '2500-2599', name: 'Intercompany Liabilities', reason: 'Reserved for intercompany payables and eliminations', reservedBy: 'admin@acme.com', reservedDate: '2026-04-20', type: 'Custom', status: 'Active' },
];

const TYPE_COLORS = {
  System: 'bg-red-950/50 text-red-400 border-red-900/40',
  Category: 'bg-indigo-950/50 text-indigo-400 border-indigo-900/40',
  Custom: 'bg-amber-950/50 text-amber-400 border-amber-900/40',
};
const STATUS_COLORS = {
  Locked: { badge: 'bg-red-950/60 text-red-400 border-red-900/50', dot: 'bg-red-400' },
  Active: { badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50', dot: 'bg-emerald-400' },
};

/* ─── Modal ─── */
function ReservedCodeModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial || { code: '', range: '', name: '', reason: '', type: 'Custom', status: 'Active' }
  );
  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.code.trim() || !form.name.trim()) return;
    onSave({ ...form, reservedBy: 'admin@acme.com', reservedDate: new Date().toISOString().split('T')[0] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
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

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Start Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 8000"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Code Range</label>
              <input value={form.range} onChange={e => setForm(f => ({ ...f, range: e.target.value }))} placeholder="e.g. 8000-8999"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Reservation Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Intercompany Accounts"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
              placeholder="Why is this code range being reserved..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-600/60 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-amber-600/60 transition-all">
                <option value="Custom">Custom</option>
                <option value="Category">Category</option>
                <option value="System">System</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-amber-600/60 transition-all">
                <option value="Active">Active</option>
                <option value="Locked">Locked</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim() || !form.code.trim()}
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
  const [codes, setCodes] = useState(defaultReservedCodes);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortField, setSortField] = useState('code');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const stats = useMemo(() => ({
    total: codes.length,
    locked: codes.filter(c => c.status === 'Locked').length,
    system: codes.filter(c => c.type === 'System').length,
    custom: codes.filter(c => c.type === 'Custom').length,
  }), [codes]);

  const filtered = useMemo(() => {
    let list = [...codes];
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search) ||
      c.range.includes(search)
    );
    if (filterType !== 'All') list = list.filter(c => c.type === filterType);
    if (filterStatus !== 'All') list = list.filter(c => c.status === filterStatus);
    list.sort((a, b) => {
      const av = a[sortField] ?? ''; const bv = b[sortField] ?? '';
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [codes, search, filterType, filterStatus, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleSave = (data) => {
    if (editItem) setCodes(prev => prev.map(c => c.id === editItem.id ? { ...editItem, ...data } : c));
    else setCodes(prev => [...prev, { ...data, id: Date.now().toString() }]);
    setEditItem(null);
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
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Reserved Codes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage restricted GL code ranges and system-protected account blocks</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/40 transition-all">
            <Plus className="h-4 w-4" /> Reserve Code
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Reservations" value={stats.total} icon={Hash} iconBg="bg-amber-950/60" iconColor="text-amber-400" delay={0} />
        <StatCard title="Locked (System)" value={stats.locked} icon={Lock} iconBg="bg-red-950/60" iconColor="text-red-400" sub="Cannot be modified" delay={80} />
        <StatCard title="System Ranges" value={stats.system} icon={ShieldBan} iconBg="bg-indigo-950/60" iconColor="text-indigo-400" delay={160} />
        <StatCard title="Custom Ranges" value={stats.custom} icon={Layers} iconBg="bg-emerald-950/60" iconColor="text-emerald-400" sub="User-defined" delay={240} />
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border border-indigo-900/30 bg-indigo-950/10 px-5 py-3.5 flex items-start gap-3">
        <Info className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-indigo-300">Why Reserve GL Codes?</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Reserved code ranges prevent accidental creation of accounts in protected GL segments. System reservations enforce GAAP classification structure 
            (Assets 1000s, Liabilities 2000s, etc.), while custom reservations can block ranges for future intercompany or consolidation accounts.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code or range..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-600/50 transition-all" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none transition-all">
          {['All', 'System', 'Category', 'Custom'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none transition-all">
          {['All', 'Locked', 'Active'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                {[
                  { label: 'Code', field: 'code', w: 'w-24' },
                  { label: 'Range', w: 'w-32' },
                  { label: 'Reservation Name', field: 'name' },
                  { label: 'Type', field: 'type', w: 'w-28' },
                  { label: 'Reserved By', w: 'w-36' },
                  { label: 'Date', field: 'reservedDate', w: 'w-28' },
                  { label: 'Status', field: 'status', w: 'w-28' },
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
                <tr><td colSpan={8} className="py-16 text-center text-slate-500 text-sm">No reserved codes match your filters.</td></tr>
              ) : filtered.map((c, i) => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.Active;
                const tc = TYPE_COLORS[c.type] || TYPE_COLORS.Custom;
                return (
                  <tr key={c.id} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                    className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5"><span className="font-mono text-xs font-bold text-amber-400">{c.code}</span></td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-400 bg-slate-800/50 border border-slate-700/40 px-2 py-0.5 rounded">{c.range}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                      {c.reason && <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{c.reason}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc}`}>{c.type}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-400">{c.reservedBy}</td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-500">{c.reservedDate}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailId(c.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                        {c.type !== 'System' && (
                          <>
                            <button onClick={() => { setEditItem(c); setModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Showing {filtered.length} of {codes.length} reserved ranges</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            {stats.locked} system-locked
          </div>
        </div>
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
                ['Code', detailItem.code],
                ['Range', detailItem.range],
                ['Name', detailItem.name],
                ['Reason', detailItem.reason],
                ['Type', detailItem.type],
                ['Reserved By', detailItem.reservedBy],
                ['Date', detailItem.reservedDate],
                ['Status', detailItem.status],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
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
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => { setCodes(prev => prev.filter(c => c.id !== deleteId)); setDeleteId(null); }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all">Remove</button>
            </div>
          </div>
        </div>
      )}

      <ReservedCodeModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave} initial={editItem} />
    </div>
  );
};
