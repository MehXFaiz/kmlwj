import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

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
      acc.level === 'SUBSIDIARY' &&
      (acc.detailType === 'Cash' || (acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('cash'))
    );
  }, [flatAccounts]);

  // Offset accounts based on type
  const offsetAccounts = useMemo(() => {
    return flatAccounts.filter(acc => 
      acc.level === 'SUBSIDIARY' &&
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
      showToast('Please select a cash or bank account first.', 'warning');
      return;
    }
    if (!offsetAccountId) {
      showToast('Please select the account for this transaction.', 'warning');
      return;
    }
    if (reference && !/^[a-zA-Z0-9\s.-]{3,30}$/.test(reference)) {
      showToast('Reference must contain only letters, numbers, spaces, hyphens, and dots (3-30 chars).', 'warning');
      return;
    }
    const val = parseFloat(amount);
    if (!val || val <= 0 || !/^[1-9]\d*(\.\d{1,2})?$/.test(amount)) {
      showToast('Amount must be a positive number with up to 2 decimal places.', 'warning');
      return;
    }

    const bankAcc = bankAccounts.find(a => a.id === bankAccountId);
    const offsetAcc = offsetAccounts.find(a => a.id === offsetAccountId);

    if (!bankAcc || !offsetAcc) {
      showToast('Selected accounts are invalid. Please try again.', 'error');
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
      showToast('Transaction saved and posted to records!', 'success');
      navigate('/bank-vouchers');
    } catch (err) {
      showToast(err.message || "Couldn't save the transaction. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link to="/bank-vouchers" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Create Bank Voucher</h2>
          <p className="text-xs text-slate-500 mt-0.5">Record payments out or receipts in to Cash/Bank ledger accounts</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-6 space-y-6">
        
        {/* Transaction Type selection */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">What type of transaction is this? *</label>
          <p className="text-[11px] text-slate-600 mb-2">Example: Paying rent or salaries = Money Going Out. Receiving hall fees = Money Coming In.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => setVoucherType('BP')}
              className={`py-3.5 rounded-lg border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${voucherType === 'BP' ? 'bg-red-600/10 border-red-500 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              <TrendingDown className="h-4 w-4" />
              💸 Money Going Out
            </button>
            <button type="button" onClick={() => setVoucherType('BR')}
              className={`py-3.5 rounded-lg border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${voucherType === 'BR' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              <TrendingUp className="h-4 w-4" />
              💰 Money Coming In
            </button>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Transaction Date *</label>
            <input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Cheque / Reference Number</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. CHQ-82941"
              pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors placeholder-slate-650" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Cash / Bank Account *</label>
            <p className="text-[11px] text-slate-600 mb-1.5">{voucherType === 'BP' ? 'Money leaves from this account' : 'Money arrives in this account'}</p>
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors">
              {bankAccounts.length === 0 ? (
                <option value="">-- No Cash/Bank Accounts Found --</option>
              ) : (
                bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">
              {voucherType === 'BP' ? 'Expense Category *' : 'Income Category *'}
            </label>
            <p className="text-[11px] text-slate-600 mb-1.5">{voucherType === 'BP' ? 'What was this money spent on?' : 'What type of income is this?'}</p>
            <select value={offsetAccountId} onChange={e => setOffsetAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors">
              {offsetAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
              {offsetAccounts.length === 0 && (
                <option value="">-- No accounts found --</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Amount (PKR) *</label>
          <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            pattern="^[1-9]\d*(\.\d{1,2})?$" title="Positive number with up to 2 decimal places"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-600/50 transition-colors placeholder-slate-650" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Notes / Description</label>
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
