import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save } from 'lucide-react';

export const BankVoucherForm = () => {
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();

  const [voucherType, setVoucherType] = useState('BP'); // BP or BR
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  // Asset accounts for bank selection
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc => 
      acc.type === 'Asset' && 
      acc.detailType === 'Subsidiary' &&
      ((acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('cash'))
    );
  }, [flatAccounts]);

  // Offset accounts based on type
  const offsetAccounts = useMemo(() => {
    return flatAccounts.filter(acc => 
      acc.detailType === 'Subsidiary' &&
      (voucherType === 'BP' ? acc.type === 'Expense' : acc.type === 'Revenue')
    );
  }, [flatAccounts, voucherType]);

  // Pre-fill selection inputs
  useEffect(() => {
    if (bankAccounts.length > 0) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts]);

  useEffect(() => {
    if (offsetAccounts.length > 0) {
      setOffsetAccountId(offsetAccounts[0].id);
    } else {
      setOffsetAccountId('');
    }
  }, [offsetAccounts, voucherType]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bankAccountId) {
      alert("Please select a Cash/Bank account");
      return;
    }
    if (!offsetAccountId) {
      alert("Please select an offset account");
      return;
    }
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    const bankAcc = bankAccounts.find(a => a.id === bankAccountId);
    const offsetAcc = offsetAccounts.find(a => a.id === offsetAccountId);

    if (!bankAcc || !offsetAcc) {
      alert("Selected accounts are invalid");
      return;
    }

    // Build the lines for the Journal Entry
    const lines = [];
    if (voucherType === 'BP') {
      // Debit: Offset Account (e.g. Rent Expense)
      // Credit: Bank Account (Asset)
      lines.push(
        { accountCode: offsetAcc.code, debit: val, credit: 0, description: `Bank Payout: ${description || reference || 'Payment'}` },
        { accountCode: bankAcc.code, debit: 0, credit: val, description: `Bank Payout: ${description || reference || 'Payment'}` }
      );
    } else {
      // Debit: Bank Account (Asset)
      // Credit: Offset Account (e.g. Booking Revenue)
      lines.push(
        { accountCode: bankAcc.code, debit: val, credit: 0, description: `Bank Receipt: ${description || reference || 'Receipt'}` },
        { accountCode: offsetAcc.code, debit: 0, credit: val, description: `Bank Receipt: ${description || reference || 'Receipt'}` }
      );
    }

    const prefix = voucherType;
    const timeStr = Date.now().toString().slice(-6);
    const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

    const payload = {
      voucherNo,
      postingDate: new Date(postingDate).toISOString(),
      subsidiary: 'Global',
      reference: reference || 'Bank Transaction',
      description: description || null,
      status: 'Posted', // Post immediately to ledger
      voucherType,
      lines
    };

    setLoading(true);
    try {
      await addVoucher(payload);
      navigate('/bank-vouchers');
    } catch (err) {
      alert(err.message || "Failed to create voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/bank-vouchers" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              Create Bank Voucher
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record payments out or receipts in to Cash/Bank ledger accounts
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl rounded-xl border border-slate-800/70 bg-slate-900/40 p-6 space-y-6">
        
        {/* Voucher Type selection */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Voucher Classification</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setVoucherType('BP')}
              className={`py-3 rounded-lg border text-sm font-bold transition-all cursor-pointer ${voucherType === 'BP' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              Bank Payment (BP) — Payout
            </button>
            <button type="button" onClick={() => setVoucherType('BR')}
              className={`py-3 rounded-lg border text-sm font-bold transition-all cursor-pointer ${voucherType === 'BR' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              Bank Receipt (BR) — Deposit
            </button>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Transaction Date *</label>
            <input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ref / Cheque Number</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. CHQ-82941"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors placeholder-slate-650" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank / Cash Account *</label>
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors">
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {voucherType === 'BP' ? 'Expense Account (Debit) *' : 'Revenue Account (Credit) *'}
            </label>
            <select value={offsetAccountId} onChange={e => setOffsetAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors">
              {offsetAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
              {offsetAccounts.length === 0 && (
                <option value="">-- No Subsidiary Accounts Found --</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Voucher Amount (PKR) *</label>
          <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors placeholder-slate-650" />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Voucher Description / Memo</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write details about this transaction..."
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors h-24 resize-none placeholder-slate-650" />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-800/80">
          <Link to="/bank-vouchers"
            className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-900/40 transition-all disabled:opacity-50">
            <Save className="h-4 w-4" />
            {loading ? 'Posting...' : 'Save & Post'}
          </button>
        </div>
      </form>
    </div>
  );
};
