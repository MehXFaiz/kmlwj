import { useState, useEffect, useMemo } from 'react';
import { useDonationStore } from '../store/donationStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { useCoaStore } from '../store/coaStore';
import { Heart, Search, Plus, Edit2, Trash2, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

function DonationModal({ isOpen, onClose, onSave, initial, beneficiaries, accounts }) {
  const [form, setForm] = useState(
    initial || { beneficiaryId: '', donationType: 'MONTHLY', amount: '', paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', remarks: '' }
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial || { beneficiaryId: '', donationType: 'MONTHLY', amount: '', paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', remarks: '' });
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.beneficiaryId || !form.amount || !form.paymentMethod) return;
    onSave({ ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-pink-950/60 border border-pink-800/40 flex items-center justify-center">
              <Heart className="h-4 w-4 text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Donation' : 'New Donation'}</h3>
              <p className="text-[11px] text-slate-500">Log a new donation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Beneficiary *</label>
            <select value={form.beneficiaryId} onChange={e => setForm(f => ({ ...f, beneficiaryId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
              <option value="">Select Beneficiary</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>{b.name} {b.cnic ? `(${b.cnic})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Donation Type *</label>
              <select value={form.donationType} onChange={e => setForm(f => ({ ...f, donationType: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
                {['MONTHLY', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION', 'CUSTOM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="10000" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '' }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
              {['CASH', 'BANK', 'CHEQUE'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Account *</label>
                <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
                  <option value="">Select Bank Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.accountName}</option>
                  ))}
                </select>
              </div>
              {form.paymentMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cheque Number *</label>
                  <input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))}
                    placeholder="CHQ-001" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all h-20 resize-none" />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.beneficiaryId || !form.amount || (form.paymentMethod !== 'CASH' && !form.bankAccountId) || (form.paymentMethod === 'CHEQUE' && !form.chequeNumber)}
            className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-lg shadow-pink-900/40">
            {initial ? 'Save Changes' : 'Create Donation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Donations = () => {
  const { donations, fetchDonations, addDonation, updateDonation, approveDonation } = useDonationStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [approveId, setApproveId] = useState(null);

  useEffect(() => {
    fetchDonations();
    fetchBeneficiaries();
    fetchAccountsList();
  }, [fetchDonations, fetchBeneficiaries, fetchAccountsList]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => a.accountName.toLowerCase().includes('bank') || a.accountType?.name?.toLowerCase() === 'bank');
  }, [flatAccounts]);

  const filtered = useMemo(() => {
    return donations.filter(d => 
      (d.beneficiary?.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (d.donationType || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.paymentMethod || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [donations, search]);

  const handleSave = async (data) => {
    if (editItem) {
      await updateDonation(editItem.id, data);
    } else {
      await addDonation(data);
    }
    setEditItem(null);
  };

  const handleApprove = async (id) => {
    await approveDonation(id);
    setApproveId(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-400 bg-pink-950/50 border border-pink-900/60 px-2.5 py-0.5 rounded-full">
              <Heart className="h-3 w-3" /> Donation Management
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Donations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage and approve charitable donations</p>
        </div>
        <div className={pageActionsClass}>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Log Donation
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search donations..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-pink-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Beneficiary</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Method</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Created</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-200">{d.beneficiary?.name}</p></td>
                    <td className="px-4 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/50 text-slate-300 border-slate-700/40">{d.donationType}</span></td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-200">{d.amount.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{d.paymentMethod}</td>
                    <td className="px-4 py-3.5">
                      {d.status === 'APPROVED' ? (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Approved</span>
                      ) : (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/60 text-amber-400 border-amber-900/50">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.status === 'PENDING' && (
                          <>
                            <button onClick={() => setApproveId(d.id)} className="p-1.5 rounded-lg hover:bg-emerald-950/40 text-emerald-500 hover:text-emerald-400" title="Approve">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setEditItem(d); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(d => (
              <div key={d.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-slate-200">{d.beneficiary?.name}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${d.status === 'APPROVED' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' : 'bg-amber-950/60 text-amber-400 border-amber-900/50'}`}>{d.status}</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">{d.donationType} | {d.paymentMethod} | <span className="font-bold text-slate-200">{d.amount.toLocaleString()}</span></div>
                {d.status === 'PENDING' && (
                  <div className="flex justify-between mt-3 pt-3 border-t border-slate-800/50">
                     <button onClick={() => setApproveId(d.id)} className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approve</button>
                     <button onClick={() => { setEditItem(d); setModalOpen(true); }} className="text-xs text-slate-400 hover:text-white">Edit</button>
                  </div>
                )}
              </div>
            ))}
        </MobileOnly>
      </div>

      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApproveId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-emerald-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Approve Donation</h4>
            <p className="text-xs text-slate-400 mb-4">This will generate a Journal Entry and update Ledger balances automatically. Proceed?</p>
            <div className="flex gap-3">
              <button onClick={() => setApproveId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold">Cancel</button>
              <button onClick={() => handleApprove(approveId)} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">Approve</button>
            </div>
          </div>
        </div>
      )}

      <DonationModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSave={handleSave} initial={editItem} beneficiaries={beneficiaries} accounts={bankAccounts} />
    </div>
  );
};
