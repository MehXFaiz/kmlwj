import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, RefreshCw, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../components/ui/Toast';

export const TransferForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();

  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [fromBankAccountId, setFromBankAccountId] = useState('');
  const [toBankAccountId, setToBankAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  // Asset accounts containing 'bank' or 'cash'
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc =>
      acc.type === 'Asset' &&
      acc.level === 'SUBSIDIARY' &&
      (acc.detailType === 'Cash' || (acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('cash'))
    );
  }, [flatAccounts]);

  // Set default values for bank accounts
  useEffect(() => {
    if (bankAccounts.length > 1) {
      if (!fromBankAccountId) setFromBankAccountId(bankAccounts[0].id);
      if (!toBankAccountId) setToBankAccountId(bankAccounts[1].id);
    } else if (bankAccounts.length > 0) {
      if (!fromBankAccountId) setFromBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, fromBankAccountId, toBankAccountId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fromBankAccountId || !toBankAccountId) {
      showToast("Please select both source and target accounts", "warning");
      return;
    }
    if (fromBankAccountId === toBankAccountId) {
      showToast("Source and Target accounts cannot be the same", "warning");
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

    const fromAcc = bankAccounts.find(a => a.id === fromBankAccountId);
    const toAcc = bankAccounts.find(a => a.id === toBankAccountId);

    if (!fromAcc || !toAcc) {
      showToast("Selected accounts are invalid", "error");
      return;
    }

    setLoading(true);
    try {
      const memo = description || `Transfer from ${fromAcc.name} to ${toAcc.name}`;

      // Build lines:
      // Debit: To Account (Asset increases)
      // Credit: From Account (Asset decreases)
      const lines = [
        { accountCode: toAcc.code, debit: val, credit: 0, description: `Fund Transfer: ${memo}` },
        { accountCode: fromAcc.code, debit: 0, credit: val, description: `Fund Transfer: ${memo}` }
      ];

      const prefix = 'BT'; // Bank Transfer
      const timeStr = Date.now().toString().slice(-6);
      const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

      const payload = {
        voucherNo,
        postingDate: new Date(postingDate).toISOString(),
        subsidiary: 'Global',
        reference: reference || 'Fund Transfer',
        description: memo,
        status: 'Posted',
        voucherType: 'JV', // Represented as Journal Entry
        lines
      };

      await addVoucher(payload);
      navigate('/bank-vouchers');
    } catch (err) {
      showToast(err.message || "Failed to post transfer", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all font-medium';
  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/bank-vouchers"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-400 bg-violet-950/40 border border-violet-900/40 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3 text-violet-400" /> {t('forms.fundTransfer')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">{t('forms.transferFunds')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('forms.transferFundsDesc')}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
          Fund Transfer
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Info Card */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-indigo-500/5 rounded-2xl border border-indigo-500/20 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-300">Transfer Guidelines</h3>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Use this form to record internal fund transfers between cash and bank accounts.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Double Entry Automated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form Cards */}
          <div className="lg:col-span-8 space-y-5">

            {/* Card 01: Account Selection */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                  01
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Account Selection</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                  {/* Visual transfer indicator */}
                  <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-indigo-400 z-10">
                    <RefreshCw className="h-4 w-4 animate-spin-slow" />
                  </div>

                  <div>
                    <label className={labelClass}>{t('forms.sourceAccountFrom')}</label>
                    <select
                      value={fromBankAccountId}
                      onChange={e => setFromBankAccountId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t('forms.selectSourceAccount')}</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-600 mt-1.5">{t('forms.fundsDeductedFromHere')}</p>
                  </div>

                  <div>
                    <label className={labelClass}>{t('forms.targetAccountTo')}</label>
                    <select
                      value={toBankAccountId}
                      onChange={e => setToBankAccountId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t('forms.selectTargetAccount')}</option>
                      {bankAccounts.filter(acc => acc.id !== fromBankAccountId).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-600 mt-1.5">{t('forms.fundsAddedToHere')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 02: Transaction Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Transaction Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t('forms.transactionDate')}</label>
                  <input
                    type="date"
                    value={postingDate}
                    onChange={e => setPostingDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('forms.refChequeNumber')}</label>
                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={t('forms.trfPlaceholder')}
                    pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('forms.transferAmount')}</label>
                  <input
                    type="text"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    pattern="^[1-9]\d*(\.\d{1,2})?$" title="Positive number with up to 2 decimal places"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t('forms.voucherDescription')}</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('forms.voucherDescription')}
                    className={inputClass + ' resize-none h-24'}
                  />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link to="/bank-vouchers"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                {t('forms.cancel')}
              </Link>
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
                <Save className="h-4 w-4" />
                {loading ? t('forms.posting') : t('forms.saveAndPost')}
              </button>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
