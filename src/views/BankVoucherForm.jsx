import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { useJournalStore, calculateAccountBalances } from '../store/journalStore';
import { ChevronLeft, Save, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const BankVoucherForm = () => {
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();
  const { journals, fetchJournals } = useJournalStore();

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
    fetchJournals('Global', 1, 1000);
  }, [fetchAccountsList, fetchJournals]);

  // Asset accounts for bank selection
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc =>
      acc.type === 'Asset' &&
      acc.detailType !== 'Header' &&
      (acc.level === 'GL' || acc.level === 'SUBSIDIARY') &&
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
    const val = parseInt(amount, 10);
    if (!val || val <= 0 || !/^[1-9]\d*$/.test(amount)) {
      showToast('Amount must be a positive whole number.', 'warning');
      return;
    }

    const bankAcc = bankAccounts.find(a => a.id === bankAccountId);
    const offsetAcc = offsetAccounts.find(a => a.id === offsetAccountId);

    if (!bankAcc || !offsetAcc) {
      showToast('Selected accounts are invalid. Please try again.', 'error');
      return;
    }

    if (voucherType === 'BP') {
      const { localBalances } = calculateAccountBalances(flatAccounts, journals, 'Global');
      const avail = localBalances[bankAcc.code] !== undefined ? localBalances[bankAcc.code] : (bankAcc.initialBalance || 0);
      if (val > avail) {
        const isCash = bankAcc.detailType === 'Cash' || (bankAcc.name || '').toLowerCase().includes('cash');
        const availNum = Number(avail) || 0;
        const shortfall = val - availNum;
        const formattedAvailable = availNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const formattedRequired = val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const formattedShortfall = shortfall.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        const msg = isCash
          ? `Insufficient Cash Balance.\nAvailable Cash: Rs ${formattedAvailable}\nRequired Amount: Rs ${formattedRequired}\nShortfall: Rs ${formattedShortfall}`
          : `Insufficient Bank Balance.\nAvailable Balance: Rs ${formattedAvailable}\nRequired Amount: Rs ${formattedRequired}\nShortfall: Rs ${formattedShortfall}`;

        showToast(msg, 'error');
        return;
      }
    }

    // Build the lines for the Journal Entry
    const lines = [];
    if (voucherType === 'BP') {
      lines.push(
        { accountCode: offsetAcc.code, debit: val, credit: 0, description: `Bank Payout: ${description || reference || 'Payment'}` },
        { accountCode: bankAcc.code, debit: 0, credit: val, description: `Bank Payout: ${description || reference || 'Payment'}` }
      );
    } else {
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
      status: 'Posted',
      voucherType,
      lines
    };

    setLoading(true);
    try {
      await addVoucher(payload);
      showToast('Transaction saved and posted to records!', 'success');
      navigate('/bank-vouchers');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || err.message || "Couldn't save the transaction. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/bank-vouchers"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Create Bank Voucher</h1>
            <p className="text-xs text-slate-500 mt-0.5">Record payments out or receipts in to Cash/Bank ledger</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          New Voucher
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Info Card */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-amber-500/5 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Voucher Information</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Bank Payout: Money Going Out</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Bank Receipt: Money Coming In</span>
                </div>
              </div>
              <div className="border-t border-amber-500/20 my-4" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory for posting a transaction. Ensure correct ledger mapping.
              </p>
            </div>
          </div>

          {/* Right Column: Form Cards */}
          <div className="lg:col-span-8 space-y-5">
            {/* Card 01: Transaction Type */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  01
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Transaction Type</h3>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-slate-500">Example: Paying rent or salaries = Money Going Out. Receiving hall fees = Money Coming In.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setVoucherType('BP')}
                    className={`py-3.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${voucherType === 'BP' ? 'bg-red-600/10 border-red-500/60 text-red-400' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
                    <TrendingDown className="h-4 w-4" />
                    💸 Money Going Out
                  </button>
                  <button type="button" onClick={() => setVoucherType('BR')}
                    className={`py-3.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${voucherType === 'BR' ? 'bg-emerald-600/10 border-emerald-500/60 text-emerald-400' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
                    <TrendingUp className="h-4 w-4" />
                    💰 Money Coming In
                  </button>
                </div>
              </div>
            </div>

            {/* Card 02: Transaction Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Transaction Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Transaction Date *</label>
                  <input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)}
                    className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Cheque / Reference Number</label>
                  <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. CHQ-82941"
                    pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
                    className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Cash / Bank Account *</label>
                  <p className="text-xs text-slate-600 mb-1.5">{voucherType === 'BP' ? 'Money leaves from this account' : 'Money arrives in this account'}</p>
                  <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
                    className={inputClass}>
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
                  <label className={labelClass}>
                    {voucherType === 'BP' ? 'Expense Category *' : 'Income Category *'}
                  </label>
                  <p className="text-xs text-slate-600 mb-1.5">{voucherType === 'BP' ? 'What was this money spent on?' : 'What type of income is this?'}</p>
                  <select value={offsetAccountId} onChange={e => setOffsetAccountId(e.target.value)}
                    className={inputClass}>
                    {offsetAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                    {offsetAccounts.length === 0 && (
                      <option value="">-- No accounts found --</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Amount (PKR) *</label>
                  <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                    pattern="^[1-9]\d*(\.\d{1,2})?$" title="Positive number with up to 2 decimal places"
                    className={inputClass} />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Notes / Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write details about this transaction..."
                    className={inputClass + ' resize-none h-24'} />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/bank-vouchers"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                Cancel
              </Link>
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
                <Save className="h-4 w-4" />
                {loading ? 'Posting...' : 'Save & Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
