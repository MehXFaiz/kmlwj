import { useState, useEffect, useMemo } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import {
  TrendingDown, Search, Plus, ChevronDown, ChevronUp, BarChart3,
  CheckCircle2, Edit2, Trash2, Download, X, AlertTriangle, Layers,
  DollarSign, ArrowDownRight, Tag,
} from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass, statGridClass } from '../components/common/responsive';

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

/* ─── Modal ─── */
function ExpenseHeadModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial || { name: '', code: '', category: 'Operating', description: '', status: 'Active', budget: '', costCenter: '' }
  );
  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim()) return;
    onSave({ ...form, budget: parseFloat(form.budget) || 0 });
    onClose();
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Expense Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="e.g. EH-6100"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-red-600/60 focus:ring-1 focus:ring-red-600/30 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-red-600/60 transition-all">
                {['Operating', 'COGS', 'Administrative', 'Payroll', 'Marketing', 'Finance', 'Tax', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Expense Head Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Salaries and Wages"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-red-600/60 focus:ring-1 focus:ring-red-600/30 transition-all" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cost Center</label>
            <input value={form.costCenter} onChange={e => setForm(f => ({ ...f, costCenter: e.target.value }))}
              placeholder="e.g. HR, Finance, Operations"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-red-600/60 transition-all" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this expense category..." rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-red-600/60 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Annual Budget ($)</label>
              <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-red-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-red-600/60 transition-all">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim() || !form.code.trim()}
            className="px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-red-900/40">
            {initial ? 'Save Changes' : 'Create Expense Head'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Default Data ─── */
const defaultExpenseHeads = [
  { id: '1', code: 'EH-5100', name: 'Cost of Goods Sold (COGS)', category: 'COGS', costCenter: 'Operations', description: 'Direct costs of inventory sold', status: 'Active', budget: 180000, actual: 165000 },
  { id: '2', code: 'EH-6100', name: 'Salaries & Wages', category: 'Payroll', costCenter: 'HR', description: 'Employee compensation and payroll taxes', status: 'Active', budget: 90000, actual: 82000 },
  { id: '11', code: 'EH-6110', name: 'Salaries', category: 'Payroll', costCenter: 'HR', description: 'Payroll and salaries', status: 'Active', budget: 90000, actual: 82000 },
  { id: '3', code: 'EH-6200', name: 'Rent Expense', category: 'Operating', costCenter: 'Facilities', description: 'Office and warehouse rental costs', status: 'Active', budget: 24000, actual: 18000 },
  { id: '12', code: 'EH-6210', name: 'Fuel', category: 'Operating', costCenter: 'Logistics', description: 'Fuel and transportation fuel costs', status: 'Active', budget: 8000, actual: 4200 },
  { id: '13', code: 'EH-6220', name: 'Repairs', category: 'Operating', costCenter: 'Facilities', description: 'Repairs and maintenance', status: 'Active', budget: 10000, actual: 5200 },
  { id: '14', code: 'EH-6230', name: 'Audit Fees', category: 'Finance', costCenter: 'Finance', description: 'External audit and assurance fees', status: 'Active', budget: 6000, actual: 2000 },
  { id: '15', code: 'EH-6240', name: 'Legal Fees', category: 'Administrative', costCenter: 'Legal', description: 'Legal, consultancy and compliance fees', status: 'Active', budget: 7000, actual: 3000 },
  { id: '16', code: 'EH-6250', name: 'Security', category: 'Administrative', costCenter: 'Facilities', description: 'Security services and personnel costs', status: 'Active', budget: 5000, actual: 2800 },
  { id: '17', code: 'EH-6260', name: 'Bank Charges', category: 'Finance', costCenter: 'Finance', description: 'Bank fees and merchant charges', status: 'Active', budget: 2000, actual: 1200 },
  { id: '4', code: 'EH-6300', name: 'Utilities Expense', category: 'Operating', costCenter: 'Facilities', description: 'Electricity, water, gas, internet charges', status: 'Active', budget: 5000, actual: 3400 },
  { id: '5', code: 'EH-6400', name: 'Marketing & Advertising', category: 'Marketing', costCenter: 'Marketing', description: 'Paid ads, digital campaigns, events', status: 'Active', budget: 20000, actual: 14500 },
  { id: '6', code: 'EH-6500', name: 'Office Supplies & Software', category: 'Administrative', costCenter: 'IT', description: 'SaaS licenses, stationery, equipment', status: 'Active', budget: 8000, actual: 6100 },
  { id: '7', code: 'EH-7100', name: 'Interest Expense', category: 'Finance', costCenter: 'Finance', description: 'Interest paid on loans and credit facilities', status: 'Active', budget: 3000, actual: 2400 },
  { id: '8', code: 'EH-7200', name: 'Income Tax Expense', category: 'Tax', costCenter: 'Finance', description: 'Corporate income tax provisions', status: 'Active', budget: 15000, actual: 11000 },
  { id: '9', code: 'EH-6600', name: 'Travel & Entertainment', category: 'Administrative', costCenter: 'Sales', description: 'Business travel, meals, client entertainment', status: 'Inactive', budget: 12000, actual: 0 },
];

const STATUS_COLORS = {
  Active: { badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50', dot: 'bg-emerald-400' },
  Inactive: { badge: 'bg-slate-800/60 text-slate-400 border-slate-700/50', dot: 'bg-slate-500' },
  Pending: { badge: 'bg-amber-950/60 text-amber-400 border-amber-900/50', dot: 'bg-amber-400' },
};
const CAT_COLORS = {
  'Operating': 'bg-blue-950/50 text-blue-400 border-blue-900/40',
  'COGS': 'bg-orange-950/50 text-orange-400 border-orange-900/40',
  'Administrative': 'bg-slate-800/50 text-slate-400 border-slate-700/40',
  'Payroll': 'bg-violet-950/50 text-violet-400 border-violet-900/40',
  'Marketing': 'bg-pink-950/50 text-pink-400 border-pink-900/40',
  'Finance': 'bg-cyan-950/50 text-cyan-400 border-cyan-900/40',
  'Tax': 'bg-red-950/50 text-red-400 border-red-900/40',
  'Other': 'bg-slate-800/50 text-slate-400 border-slate-700/40',
};

export const ExpenseHeads = () => {
  const { heads, fetchHeads, addHead, updateHead, deleteHead } = useExpenseStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [sortField, setSortField] = useState('code');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchHeads();
  }, [fetchHeads]);

  const stats = useMemo(() => ({
    total: heads.length,
    active: heads.filter(h => h.status === 'Active').length,
    totalBudget: heads.reduce((s, h) => s + h.budget, 0),
    totalActual: heads.reduce((s, h) => s + h.actual, 0),
    overBudget: heads.filter(h => h.actual > h.budget).length,
  }), [heads]);

  const categories = useMemo(() => ['All', ...new Set(heads.map(h => h.category))], [heads]);

  const filtered = useMemo(() => {
    let list = [...heads];
    if (search) list = list.filter(h =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.code.toLowerCase().includes(search.toLowerCase()) ||
      (h.costCenter || '').toLowerCase().includes(search.toLowerCase())
    );
    if (filterStatus !== 'All') list = list.filter(h => h.status === filterStatus);
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
    if (editItem) {
      await updateHead(editItem.id, data);
    } else {
      await addHead(data);
    }
    setEditItem(null);
  };

  const handleDelete = async (id) => {
    await deleteHead(id);
    setDeleteId(null);
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
              <TrendingDown className="h-3 w-3" /> Expense Management
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Expense Heads</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track cost centers, expense categories and budget utilization</p>
        </div>
        <div className={pageActionsClass}>
          <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> New Expense Head
          </button>
        </div>
      </div>

      <div className={statGridClass}>
        <StatCard title="Total Expense Heads" value={stats.total} icon={Layers} iconBg="bg-red-950/60" iconColor="text-red-400" delay={0} />
        <StatCard title="Active Cost Centers" value={stats.active} icon={CheckCircle2} iconBg="bg-slate-800/60" iconColor="text-slate-400"
          sub={stats.overBudget > 0 ? `${stats.overBudget} over budget` : 'All within budget'} delay={80} />
        <StatCard title="Total Budget" value={stats.totalBudget} prefix="$" icon={BarChart3} iconBg="bg-blue-950/60" iconColor="text-blue-400" delay={160} />
        <StatCard title="Total Spent" value={stats.totalActual} prefix="$" icon={DollarSign} iconBg="bg-orange-950/60" iconColor="text-orange-400"
          sub={`${stats.totalBudget > 0 ? ((stats.totalActual / stats.totalBudget) * 100).toFixed(1) : 0}% of budget`} delay={240} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code or cost center..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-600/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-red-600/50 transition-all">
          {['All', 'Active', 'Inactive', 'Pending'].map(s => <option key={s}>{s}</option>)}
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
            const pct = h.budget > 0 ? Math.min((h.actual / h.budget) * 100, 100) : 0;
            const overBudget = h.actual > h.budget;
            const sc = STATUS_COLORS[h.status] || STATUS_COLORS.Inactive;
            const cc = CAT_COLORS[h.category] || CAT_COLORS.Other;
            return (
              <div key={h.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3" style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-red-400">{h.code}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{h.status}</span>
                </div>
                <p className="text-sm font-semibold text-slate-200 mb-1">{h.name}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
                  {h.costCenter && <span className="text-[10px] text-slate-500 flex items-center gap-1"><Tag className="h-3 w-3" />{h.costCenter}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                  <div><span className="text-slate-500 block">Budget</span><span className="font-mono font-semibold text-slate-300">${h.budget.toLocaleString()}</span></div>
                  <div><span className="text-slate-500 block">Actual</span><span className={`font-mono font-bold ${overBudget ? 'text-red-400' : 'text-slate-300'}`}>${h.actual.toLocaleString()}</span></div>
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-slate-800/50">
                  <button onClick={() => { setEditItem(h); setModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-semibold"><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => setDeleteId(h.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-950/30 text-red-400 text-xs font-semibold"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </div>
            );
          })}
        </MobileOnly>
        <DesktopOnly>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                {[
                  { label: 'Code', field: 'code', w: 'w-28' },
                  { label: 'Expense Head', field: 'name' },
                  { label: 'Category', field: 'category', w: 'w-32' },
                  { label: 'Cost Center', field: 'costCenter', w: 'w-32' },
                  { label: 'Budget', field: 'budget', w: 'w-32' },
                  { label: 'Actual', field: 'actual', w: 'w-32' },
                  { label: 'Utilization', w: 'w-40' },
                  { label: 'Status', field: 'status', w: 'w-28' },
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
                <tr><td colSpan={9} className="py-16 text-center text-slate-500 text-sm">
                  No expense heads found. <button onClick={() => setModalOpen(true)} className="text-red-400 hover:underline ml-1">Add one?</button>
                </td></tr>
              ) : filtered.map((h, i) => {
                const pct = h.budget > 0 ? Math.min((h.actual / h.budget) * 100, 100) : 0;
                const overBudget = h.actual > h.budget;
                const sc = STATUS_COLORS[h.status] || STATUS_COLORS.Inactive;
                const cc = CAT_COLORS[h.category] || CAT_COLORS.Other;
                return (
                  <tr key={h.id} style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                    className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5"><span className="font-mono text-xs font-bold text-red-400">{h.code}</span></td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-200">{h.name}</p>
                      {h.description && <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{h.description}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc}`}>{h.category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400"><Tag className="h-3 w-3" />{h.costCenter || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm font-semibold text-slate-300">${h.budget.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-mono text-sm font-bold ${overBudget ? 'text-red-400' : 'text-slate-300'}`}>
                        ${h.actual.toLocaleString()}
                        {overBudget && <span className="ml-1 text-[9px] text-red-500">▲ Over</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${overBudget ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[11px] font-mono font-bold w-10 text-right ${overBudget ? 'text-red-400' : 'text-slate-400'}`}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(h); setModalOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(h.id)}
                          className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </DesktopOnly>
        <div className="px-4 py-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">Showing {filtered.length} of {heads.length} expense heads</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            Total actual: <span className="font-mono font-bold text-red-400 ml-1">${stats.totalActual.toLocaleString()}</span>
          </div>
        </div>
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
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ExpenseHeadModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSave={handleSave} initial={editItem} />
    </div>
  );
};
