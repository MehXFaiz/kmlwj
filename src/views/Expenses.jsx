import { useState, useEffect } from 'react';
import { useSimpleExpenseStore } from '../store/simpleExpenseStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCoaStore } from '../store/coaStore';
import { MinusCircle, Search, X, CheckCircle2, TrendingDown, Building2, Banknote, Edit, Trash2 } from 'lucide-react';

function ExpenseModal({ isOpen, onClose, onSave, expenseHeads, accounts, editingExpense }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], expenseHeadId: '', paidTo: '', description: '', amount: '', paymentMethod: 'CASH', bankAccountId: '', reference: '' });

  useEffect(() => {
    if (isOpen) {
      if (editingExpense) {
        setForm({
          date: editingExpense.date ? new Date(editingExpense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          expenseHeadId: editingExpense.expenseHeadId || '',
          paidTo: editingExpense.paidTo || '',
          description: editingExpense.description || '',
          amount: editingExpense.amount !== undefined ? editingExpense.amount.toString() : '',
          paymentMethod: editingExpense.paymentMethod || 'CASH',
          bankAccountId: editingExpense.bankAccountId || '',
          reference: editingExpense.reference || ''
        });
      } else {
        setForm({ date: new Date().toISOString().split('T')[0], expenseHeadId: '', paidTo: '', description: '', amount: '', paymentMethod: 'CASH', bankAccountId: '', reference: '' });
      }
    }
  }, [isOpen, editingExpense]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.expenseHeadId || !form.amount || !form.date) return;
    onSave({ ...form, amount: Number(form.amount) });
    onClose();
  };

  const bankAccounts = accounts.filter(a => a.type === 'Asset' && !a.children?.length && a.name.toLowerCase().includes('bank'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-red-900/40 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-950/60 border border-red-800/40 flex items-center justify-center">
              <MinusCircle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{editingExpense ? 'Edit Expense' : 'Record Expense'}</h3>
              <p className="text-[11px] text-slate-500">{editingExpense ? 'Update business expense details' : 'Log a new business expense'}</p>
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
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (PKR) *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="2500" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Expense Head *</label>
              <select value={form.expenseHeadId} onChange={e => setForm(f => ({ ...f, expenseHeadId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all">
                <option value="">Select Expense Type...</option>
                {expenseHeads.filter(h => h.isActive).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Paid To (Vendor/Person)</label>
              <input type="text" value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))}
                placeholder="K-Electric, Ali, etc." className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              placeholder="e.g. Utility bill for May"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
              <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', reference: '' }))} 
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all">
                {['CASH', 'BANK'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.paymentMethod === 'BANK' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Account *</label>
                <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all">
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
                placeholder="Cheque / Ref No" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-red-600/60 transition-all" />
            </div>
          )}

        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.expenseHeadId || !form.amount}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle2 className="h-4 w-4" /> {editingExpense ? 'Update Expense' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Expenses = () => {
  const { expenses, isLoading, fetchExpenses, createExpense, updateExpense, deleteExpense } = useSimpleExpenseStore();
  const { heads: expenseHeads, fetchHeads } = useExpenseStore();
  const { accounts, fetchAccounts } = useCoaStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExpenses();
    fetchHeads();
    fetchAccounts();
  }, [fetchExpenses, fetchHeads, fetchAccounts]);

  const filteredExpenses = expenses.filter(exp => 
    exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.expenseHead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.paidTo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Expense Payments</h2>
          <p className="text-xs text-slate-500 mt-1">Manage direct business expenses and cash outflows</p>
        </div>
        <button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95">
          <MinusCircle className="h-4 w-4" /> Add Expense
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" placeholder="Search expenses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
              <TrendingDown className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-300">No expense records found</h3>
            <p className="text-xs text-slate-500 mt-1">Click "Add Expense" to log a new payment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/50">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Expense Head</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid To & Desc</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Method</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="group hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-red-950/40 flex items-center justify-center shrink-0">
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-200">{exp.expenseHead?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {exp.paidTo && <span className="text-xs font-semibold text-slate-300 block">{exp.paidTo}</span>}
                      <span className="text-[11px] text-slate-500 block max-w-xs truncate">{exp.description || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {exp.paymentMethod === 'BANK' ? <Building2 className="h-3.5 w-3.5 text-blue-400" /> : <Banknote className="h-3.5 w-3.5 text-red-400" />}
                        <span className="text-[10px] font-bold text-slate-300">{exp.paymentMethod}</span>
                      </div>
                      {exp.reference && <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{exp.reference}</p>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-sm font-mono font-bold text-red-400">
                          {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingExpense(exp); setIsModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                            title="Edit Expense">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={async () => { if (window.confirm('Delete this expense?')) await deleteExpense(exp.id); }}
                            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete Expense">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingExpense(null); }} 
        onSave={async (data) => {
          if (editingExpense) {
            const success = await updateExpense(editingExpense.id, data);
            if (success) { setIsModalOpen(false); setEditingExpense(null); }
          } else {
            const success = await createExpense(data);
            if (success) setIsModalOpen(false);
          }
        }}
        expenseHeads={expenseHeads}
        accounts={accounts}
        editingExpense={editingExpense}
      />
    </div>
  );
};
