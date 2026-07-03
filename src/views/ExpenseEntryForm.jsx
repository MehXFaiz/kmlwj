import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

export const ExpenseEntryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList, addAccount } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();

  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  
  // Selected high-level expense type
  const [expenseType, setExpenseType] = useState('Salary');
  
  // Selected subsidiary account (when matched accounts exist)
  const [selectedSubAccountId, setSelectedSubAccountId] = useState('');
  
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  // Asset accounts for bank selection (same as standard voucher form)
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc => 
      acc.type === 'Asset' && 
      acc.level === 'SUBSIDIARY' &&
      (acc.detailType === 'Cash' || (acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('cash'))
    );
  }, [flatAccounts]);

  // Set default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, bankAccountId]);

  // Map high-level expense types to COA accounts
  const matchedAccounts = useMemo(() => {
    if (!expenseType) return [];
    
    return flatAccounts.filter(acc => {
      if (acc.type !== 'Expense' || acc.detailType !== 'Subsidiary') return false;
      const nameLower = (acc.name || '').toLowerCase();
      
      switch (expenseType) {
        case 'Salary':
          return nameLower.includes('salary') || nameLower.includes('salaries');
        case 'Rent':
          return nameLower.includes('rent');
        case 'Fuel':
          return nameLower.includes('fuel') || nameLower.includes('diesel') || nameLower.includes('petrol');
        case 'Bus Repair':
          return nameLower.includes('bus repair') || nameLower.includes('bus maintenance');
        case 'Generator Repair':
          return nameLower.includes('generator repair') || nameLower.includes('generator maintenance');
        case 'Legal Fee':
          return nameLower.includes('legal') || nameLower.includes('lawyer') || nameLower.includes('professional fee') || nameLower.includes('audit');
        case 'Medical Donation':
          return nameLower.includes('medical donation') || nameLower.includes('medical expense') || (nameLower.includes('donation') && nameLower.includes('medical'));
        default:
          return false;
      }
    });
  }, [expenseType, flatAccounts]);

  // Reset or set default selected sub account when matches change
  useEffect(() => {
    if (matchedAccounts.length > 0) {
      const exists = matchedAccounts.some(a => a.id === selectedSubAccountId);
      if (!exists) {
        setSelectedSubAccountId(matchedAccounts[0].id);
      }
    } else {
      setSelectedSubAccountId('');
    }
  }, [matchedAccounts, selectedSubAccountId, expenseType]);

  // Details for account auto-creation if no matches found
  const autoCreationDetails = useMemo(() => {
    if (matchedAccounts.length > 0) return null;
    
    let parentCode = '';
    let name = '';
    let parentName = '';
    
    switch (expenseType) {
      case 'Salary':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = 'Staff Salaries';
        break;
      case 'Rent':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = 'Office/Hall Rent';
        break;
      case 'Fuel':
        parentCode = '4200000';
        parentName = 'Utility Expenses';
        name = 'Fuel Expense';
        break;
      case 'Bus Repair':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = 'Bus Repair Expense';
        break;
      case 'Generator Repair':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = 'Generator Repair Expense';
        break;
      case 'Legal Fee':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = 'Legal Fee Expense';
        break;
      case 'Medical Donation':
        parentCode = '4300000';
        parentName = 'Donation Expenses';
        name = 'Medical Donation Expense';
        break;
      default:
        return null;
    }

    // Auto-calculate GL code
    const siblings = flatAccounts.filter(a => a.parentCode === parentCode);
    const sibNumeric = siblings.map(a => parseInt(a.code, 10)).filter(Number.isFinite);
    const sibMax = sibNumeric.length ? Math.max(...sibNumeric) : parseInt(parentCode, 10);
    const nextCode = String(sibMax + 1).padStart(7, '0');

    return { parentCode, parentName, name, nextCode };
  }, [expenseType, matchedAccounts, flatAccounts]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bankAccountId) {
      showToast('Please select a cash or bank account first.', 'warning');
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

    setLoading(true);
    try {
      let finalOffsetAccountId = selectedSubAccountId;
      let finalOffsetAccountCode = '';

      // If we need to auto-create the account
      if (!finalOffsetAccountId && autoCreationDetails) {
        setCreationStatus(`Creating '${autoCreationDetails.name}' ledger account...`);
        const newAcc = await addAccount({
          code: autoCreationDetails.nextCode,
          name: autoCreationDetails.name,
          type: 'Expense',
          detailType: 'Expense',
          parentCode: autoCreationDetails.parentCode,
          currency: 'PKR',
          description: `Auto-generated for ${expenseType} expense entries.`,
          initialBalance: 0,
        });
        
        finalOffsetAccountId = newAcc.id;
        finalOffsetAccountCode = newAcc.glCode;
      }

      // Re-fetch list to ensure states are aligned
      const bankAcc = bankAccounts.find(a => a.id === bankAccountId);
      let offsetAcc = flatAccounts.find(a => a.id === finalOffsetAccountId);

      // Fallback code if not found in cache yet
      if (!offsetAcc && finalOffsetAccountCode) {
        offsetAcc = { code: finalOffsetAccountCode };
      }

      if (!bankAcc || !offsetAcc) {
        throw new Error("Invalid accounts detected. Please check Chart of Accounts.");
      }

      setCreationStatus("Posting voucher to ledger...");

      // Build double-entry lines for Payout (BP)
      // Debit: Offset Account (Expense Subsidiary)
      // Credit: Bank Account (Asset)
      const memo = description || `Paid for ${expenseType}`;
      const lines = [
        { accountCode: offsetAcc.code, debit: val, credit: 0, description: `Bank Payout (${expenseType}): ${memo}` },
        { accountCode: bankAcc.code, debit: 0, credit: val, description: `Bank Payout (${expenseType}): ${memo}` }
      ];

      const prefix = 'BP';
      const timeStr = Date.now().toString().slice(-6);
      const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

      const payload = {
        voucherNo,
        postingDate: new Date(postingDate).toISOString(),
        subsidiary: 'Global',
        reference: reference || `${expenseType} Payout`,
        description: memo,
        status: 'Posted', // Post immediately to ledger
        voucherType: 'BP',
        lines
      };

      await addVoucher(payload);
      showToast('Expense recorded and posted to your accounts!', 'success');
      navigate('/bank-vouchers');
    } catch (err) {
      showToast(err.message || "Couldn't save the expense entry. Please try again.", 'error');
    } finally {
      setLoading(false);
      setCreationStatus('');
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
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-450 bg-rose-950/40 border border-rose-900/40 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3 text-rose-400" /> {t('forms.quickAdd')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('forms.addExpense')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('forms.addExpenseDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-6 space-y-6">
        
        {/* Expense Type selection */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('forms.expenseType')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'Salary', label: t('forms.sources.salary') },
              { key: 'Rent', label: t('forms.sources.rent') },
              { key: 'Fuel', label: t('forms.sources.fuel') },
              { key: 'Bus Repair', label: t('forms.sources.busRepair') },
              { key: 'Generator Repair', label: t('forms.sources.generatorRepair') },
              { key: 'Legal Fee', label: t('forms.sources.legalFee') },
              { key: 'Medical Donation', label: t('forms.sources.medicalDonation') }
            ].map(type => (
              <button
                key={type.key}
                type="button"
                onClick={() => setExpenseType(type.key)}
                className={`py-3 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                  expenseType === type.key
                    ? 'bg-rose-600/10 border-rose-500 text-rose-400 shadow-md shadow-rose-955/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Mapping Info / Sub-Selectors */}
        <div className="p-4 rounded-lg bg-slate-950/30 border border-slate-850 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550 block">{t('forms.ledgerMapping')}</span>
          
          {matchedAccounts.length > 0 ? (
            <div>
              {matchedAccounts.length === 1 ? (
                <div className="flex items-center gap-2 text-xs text-slate-350">
                  <CheckCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span>
                    {t('forms.autoLinkedTo')} <strong className="text-slate-200">{matchedAccounts[0].code} - {matchedAccounts[0].name}</strong>
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    {t('forms.selectTargetLedger')}
                  </label>
                  <select
                    value={selectedSubAccountId}
                    onChange={e => setSelectedSubAccountId(e.target.value)}
                    className="w-full max-w-md px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-rose-600/60 transition-all"
                  >
                    {matchedAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            autoCreationDetails && (
              <div className="flex items-start gap-3 p-3 rounded bg-amber-955/20 border border-amber-900/30 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-200">{t('forms.missingSubAccount')}</p>
                  <p className="text-amber-400/90 leading-relaxed">
                    No ledger account exists for <strong className="text-white">"{expenseType}"</strong>. 
                    The system will automatically generate it under <strong className="text-white">{autoCreationDetails.parentName}</strong> with code <strong className="font-mono text-white">{autoCreationDetails.nextCode}</strong> upon saving.
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Transaction Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.transactionDate')}</label>
            <input 
              type="date" 
              value={postingDate} 
              onChange={e => setPostingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-rose-600/50 transition-colors" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.paidFromBankCash')}</label>
            <select 
              value={bankAccountId} 
              onChange={e => setBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-rose-600/50 transition-colors"
            >
              {bankAccounts.length === 0 ? (
                <option value="">{t('forms.noBankAccountsFound')}</option>
              ) : (
                bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.voucherAmount')}</label>
            <input 
              type="text" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="0.00"
              pattern="^[1-9]\d*(\.\d{1,2})?$" title="Positive number with up to 2 decimal places"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-rose-600/50 transition-colors placeholder-slate-600 font-semibold" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.refChequeNumber')}</label>
            <input 
              value={reference} 
              onChange={e => setReference(e.target.value)} 
              placeholder={t('forms.chqPlaceholder')}
              pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-rose-600/50 transition-colors placeholder-slate-600" 
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.voucherDescription')}</label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder={`Details about this ${expenseType.toLowerCase()} payout...`}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-rose-600/50 transition-colors h-24 resize-none placeholder-slate-600" 
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-2 border-t border-slate-800/80 items-center">
          {creationStatus && (
            <span className="text-xs text-slate-400 animate-pulse mr-auto">
              {creationStatus}
            </span>
          )}
          <Link to="/bank-vouchers"
            className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">
            {t('forms.cancel')}
          </Link>
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-950/40 transition-all disabled:opacity-50 cursor-pointer">
            <Save className="h-4 w-4" />
            {loading ? t('forms.processing') : t('forms.saveAndPost')}
          </button>
        </div>
      </form>
    </div>
  );
};
