import { useState, useEffect, useMemo } from 'react';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { Users, Search, Plus, ChevronDown, ChevronUp, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

function BeneficiaryModal({ isOpen, onClose, onSave, initial }) {
  const [form, setForm] = useState(
    initial || { name: '', cnic: '', mobile: '', address: '', remarks: '', isActive: true }
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial || { name: '', cnic: '', mobile: '', address: '', remarks: '', isActive: true });
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center">
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Beneficiary' : 'New Beneficiary'}</h3>
              <p className="text-[11px] text-slate-500">Manage beneficiary details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full Name" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-600 focus:border-indigo-600/60 focus:outline-none transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">CNIC</label>
              <input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))}
                placeholder="00000-0000000-0" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mobile</label>
              <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                placeholder="0300-0000000" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/60 transition-all h-20 resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Remarks</label>
            <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/60 transition-all" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-slate-900 cursor-pointer" />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300 cursor-pointer">Active</label>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-900/40">
            {initial ? 'Save Changes' : 'Create Beneficiary'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Beneficiaries = () => {
  const { beneficiaries, fetchBeneficiaries, addBeneficiary, updateBeneficiary, deleteBeneficiary } = useBeneficiaryStore();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  const filtered = useMemo(() => {
    return beneficiaries.filter(b => 
      (b.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (b.cnic && b.cnic.includes(search)) ||
      (b.mobile && b.mobile.includes(search))
    );
  }, [beneficiaries, search]);

  const handleSave = async (data) => {
    if (editItem) {
      await updateBeneficiary(editItem.id, data);
    } else {
      await addBeneficiary(data);
    }
    setEditItem(null);
  };

  const handleDelete = async (id) => {
    await deleteBeneficiary(id);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400 bg-indigo-950/50 border border-indigo-900/60 px-2.5 py-0.5 rounded-full">
              <Users className="h-3 w-3" /> Beneficiary Management
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Beneficiaries</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage individuals or entities receiving donations</p>
        </div>
        <div className={pageActionsClass}>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> New Beneficiary
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, CNIC, or mobile..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">CNIC / Mobile</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Created At</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-200">{b.name}</p></td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-300">{b.cnic || 'No CNIC'}</div>
                      <div className="text-[11px] text-slate-500">{b.mobile || 'No Mobile'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {b.isActive ? (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Active</span>
                      ) : (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(b); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(b.id)} className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(b => (
              <div key={b.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-slate-200">{b.name}</h4>
                </div>
                <div className="text-xs text-slate-400 mb-2">CNIC: {b.cnic} | Mob: {b.mobile}</div>
                <div className="flex justify-between mt-3 pt-3 border-t border-slate-800/50">
                   <button onClick={() => { setEditItem(b); setModalOpen(true); }} className="text-xs text-slate-400 hover:text-white">Edit</button>
                   <button onClick={() => setDeleteId(b.id)} className="text-xs text-red-400">Delete</button>
                </div>
              </div>
            ))}
        </MobileOnly>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-red-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-4">Confirm Delete</h4>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}

      <BeneficiaryModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSave={handleSave} initial={editItem} />
    </div>
  );
};
