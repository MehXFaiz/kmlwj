import { useState, useEffect } from 'react';
import { useIncomeStore } from '../store/incomeStore';
import { useRevenueStore } from '../store/revenueStore';
import { useCoaStore } from '../store/coaStore';
import { PlusCircle, Search, X, CheckCircle2, TrendingUp, Building2, Banknote } from 'lucide-react';

function IncomeModal({ isOpen, onClose, onSave, revenueHeads, accounts }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], revenueHeadId: '', description: '', amount: '', paymentMethod: 'CASH', bankAccountId: '', reference: '' });

  useEffect(() => {
    if (isOpen) setForm({ date: new Date().toISOString().split('T')[0], revenueHeadId: '', description: '', amount: '', paymentMethod: 'CASH', bankAccountId: '', reference: '' });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.revenueHeadId || !form.amount || !form.date) return;
    onSave({ ...form, amount: Number(form.amount) });
    onClose();
  };

  const bankAccounts = accounts.filter(a => a.type === 'Asset' && !a.children?.length && a.name.toLowerCase().includes('bank'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-emerald-900/40 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
              <PlusCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Record Income</h3>
              <p className="text-[11px] text-slate-500">Add a new income entry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (PKR) *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="5000" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Revenue Head *</label>
            <select value={form.revenueHeadId} onChange={e => setForm(f => ({ ...f, revenueHeadId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all">
              <option value="">Select Revenue Source...</option>
              {revenueHeads.filter(h => h.isActive).map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              placeholder="e.g. Monthly subscription fees"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
              <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', reference: '' }))} 
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all">
                {['CASH', 'BANK'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.paymentMethod === 'BANK' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Account *</label>
                <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all">
                  <option value="">Select Bank Account...</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {form.paymentMethod === 'BANK' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transaction Reference</label>
              <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="Cheque / Ref No" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-emerald-600/60 transition-all" />
            </div>
          )}

        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.revenueHeadId || !form.amount}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle2 className="h-4 w-4" /> Save Record
          </button>
        </div>
      </div>
    </div>
  );
}

export const Income = () => {
  const { incomes, isLoading, fetchIncomes, createIncome } = useIncomeStore();
  const { heads: revenueHeads, fetchHeads } = useRevenueStore();
  const { accounts, fetchAccounts } = useCoaStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchIncomes();
    fetchHeads();
    fetchAccounts();
  }, [fetchIncomes, fetchHeads, fetchAccounts]);

  const filteredIncomes = incomes.filter(inc => 
    inc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.revenueHead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Income Receipts</h2>
          <p className="text-xs text-slate-500 mt-1">Manage direct business revenues and cash inflows</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
          <PlusCircle className="h-4 w-4" /> Add Income
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" placeholder="Search incomes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredIncomes.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
              <TrendingUp className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-300">No income records found</h3>
            <p className="text-xs text-slate-500 mt-1">Click "Add Income" to record a new receipt.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/50">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Revenue Head</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Method</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredIncomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(inc.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-emerald-950/40 flex items-center justify-center shrink-0">
                          <TrendingUp className="h-3 w-3 text-emerald-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">{inc.revenueHead?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-400 block max-w-xs truncate">{inc.description || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {inc.paymentMethod === 'BANK' ? <Building2 className="h-3.5 w-3.5 text-blue-400" /> : <Banknote className="h-3.5 w-3.5 text-emerald-400" />}
                        <span className="text-[10px] font-bold text-slate-300">{inc.paymentMethod}</span>
                      </div>
                      {inc.reference && <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{inc.reference}</p>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {inc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IncomeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={async (data) => {
          const success = await createIncome(data);
          if (success) setIsModalOpen(false);
        }}
        revenueHeads={revenueHeads}
        accounts={accounts}
      />
    </div>
  );
};
