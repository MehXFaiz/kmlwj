import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
      alert("Please select both source and target accounts");
      return;
    }
    if (fromBankAccountId === toBankAccountId) {
      alert("Source and Target accounts cannot be the same");
      return;
    }

    const val = parseFloat(amount);
    if (!val || val <= 0) {
      alert("Please enter a valid amount greater than 0");
      return;
    }

    const fromAcc = bankAccounts.find(a => a.id === fromBankAccountId);
    const toAcc = bankAccounts.find(a => a.id === toBankAccountId);

    if (!fromAcc || !toAcc) {
      alert("Selected accounts are invalid");
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
        status: 'Posted', // Post immediately to ledger
        voucherType: 'JV', // Represented as Journal Entry
        lines
      };

      await addVoucher(payload);
      navigate('/bank-vouchers');
    } catch (err) {
      alert(err.message || "Failed to post transfer");
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
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-400 bg-violet-950/40 border border-violet-900/40 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3 text-violet-450" /> {t('forms.fundTransfer')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('forms.transferFunds')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('forms.transferFundsDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-6 space-y-6">
        
        {/* Main account selection grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-xl bg-slate-950/30 border border-slate-850 relative">
          
          {/* Visual transfer indicator */}
          <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-violet-400 z-10">
            <RefreshCw className="h-4 w-4 animate-spin-slow" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-550 mb-2">{t('forms.sourceAccountFrom')}</label>
            <select 
              value={fromBankAccountId} 
              onChange={e => setFromBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-250 text-sm focus:outline-none focus:border-violet-600/50 transition-all font-semibold"
            >
              <option value="">{t('forms.selectSourceAccount')}</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1.5">{t('forms.fundsDeductedFromHere')}</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-555 mb-2">{t('forms.targetAccountTo')}</label>
            <select 
              value={toBankAccountId} 
              onChange={e => setToBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-250 text-sm focus:outline-none focus:border-violet-600/50 transition-all font-semibold"
            >
              <option value="">{t('forms.selectTargetAccount')}</option>
              {bankAccounts.filter(acc => acc.id !== fromBankAccountId).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1.5">{t('forms.fundsAddedToHere')}</p>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.transactionDate')}</label>
            <input 
              type="date" 
              value={postingDate} 
              onChange={e => setPostingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-violet-600/50 transition-colors" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.refChequeNumber')}</label>
            <input 
              value={reference} 
              onChange={e => setReference(e.target.value)} 
              placeholder={t('forms.trfPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-violet-600/50 transition-colors placeholder-slate-600" 
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.transferAmount')}</label>
          <input 
            type="number" 
            min="0" 
            step="any" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-violet-600/50 transition-colors placeholder-slate-600 font-semibold text-base" 
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.voucherDescription')}</label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder={t('forms.voucherDescription')}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-violet-600/50 transition-colors h-24 resize-none placeholder-slate-650" 
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-800/80">
          <Link to="/bank-vouchers"
            className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">
            {t('forms.cancel')}
          </Link>
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-950/40 transition-all disabled:opacity-50 cursor-pointer">
            <Save className="h-4 w-4" />
            {loading ? t('forms.posting') : t('forms.saveAndPost')}
          </button>
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
