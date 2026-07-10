import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { useJournalStore, calculateAccountBalances } from '../store/journalStore';
import { ChevronLeft, Save, Sparkles, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

export const ExpenseEntryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList, addAccount } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();
  const { journals, fetchJournals } = useJournalStore();

  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');

  // Selected high-level expense type
  const [expenseType, setExpenseType] = useState('Salary');
  const [customExpenseName, setCustomExpenseName] = useState('');

  useEffect(() => {
    if (typeParam) {
      const allowedTypes = ['Salary', 'Rent', 'Fuel', 'Bus Repair', 'Generator Repair', 'Legal Fee', 'Medical Donation', 'Zakat Distribution', 'Other'];
      if (allowedTypes.includes(typeParam)) {
        setExpenseType(typeParam);
      }
    }
  }, [typeParam]);

  useEffect(() => {
    if (expenseType !== 'Other') {
      setCustomExpenseName('');
    }
  }, [expenseType]);

  // Selected subsidiary account (when matched accounts exist)
  const [selectedSubAccountId, setSelectedSubAccountId] = useState('');

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  useEffect(() => {
    fetchAccountsList();
    fetchJournals('Global', 1, 1000);
  }, [fetchAccountsList, fetchJournals]);

  // Asset accounts for bank selection (same as standard voucher form)
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(acc =>
      acc.type === 'Asset' &&
      acc.detailType !== 'Header' &&
      (acc.level === 'GL' || acc.level === 'SUBSIDIARY') &&
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
        case 'Zakat Distribution':
          return nameLower.includes('zakat distribution') || nameLower.includes('zakat expense') || (nameLower.includes('zakat') && nameLower.includes('distrib'));
        case 'Other':
          if (customExpenseName.trim()) {
            return nameLower === customExpenseName.toLowerCase().trim() || nameLower.includes(customExpenseName.toLowerCase().trim());
          }
          return nameLower.includes('other expense') || nameLower.includes('miscellaneous') || nameLower.includes('misc') || nameLower.includes('general expense');
        default:
          return false;
      }
    });
  }, [expenseType, customExpenseName, flatAccounts]);

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
        parentCode = '4100000'; parentName = 'Administrative Expenses'; name = 'Staff Salaries'; break;
      case 'Rent':
        parentCode = '4100000'; parentName = 'Administrative Expenses'; name = 'Office/Hall Rent'; break;
      case 'Fuel':
        parentCode = '4200000'; parentName = 'Utility Expenses'; name = 'Fuel Expense'; break;
      case 'Bus Repair':
        parentCode = '4100000'; parentName = 'Administrative Expenses'; name = 'Bus Repair Expense'; break;
      case 'Generator Repair':
        parentCode = '4100000'; parentName = 'Administrative Expenses'; name = 'Generator Repair Expense'; break;
      case 'Legal Fee':
        parentCode = '4100000'; parentName = 'Administrative Expenses'; name = 'Legal Fee Expense'; break;
      case 'Medical Donation':
        parentCode = '4300000'; parentName = 'Donation Expenses'; name = 'Medical Donation Expense'; break;
      case 'Zakat Distribution':
        parentCode = '4300000'; parentName = 'Donation Expenses'; name = 'Zakat Distribution Expense'; break;
      case 'Other':
        parentCode = '4100000';
        parentName = 'Administrative Expenses';
        name = customExpenseName.trim() ? customExpenseName.trim() : 'Miscellaneous Expense';
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
  }, [expenseType, customExpenseName, matchedAccounts, flatAccounts]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (expenseType === 'Other' && !customExpenseName.trim()) {
      showToast('Please enter a custom expense name.', 'warning');
      return;
    }

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

    const bankAcc = bankAccounts.find(a => a.id === bankAccountId);
    if (bankAcc) {
      const { localBalances } = calculateAccountBalances(flatAccounts, journals, 'Global');
      const avail = localBalances[bankAcc.code] !== undefined ? localBalances[bankAcc.code] : (bankAcc.initialBalance || 0);
      if (val > avail) {
        showToast(`Cannot record expense: Amount (Rs. ${val.toLocaleString()}) exceeds available balance (Rs. ${Math.max(0, avail).toLocaleString()}) in ${bankAcc.name || 'selected account'}.`, 'error');
        return;
      }
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
      const resolvedExpenseName = expenseType === 'Other' && customExpenseName.trim() ? customExpenseName.trim() : expenseType;
      const memo = description || `Paid for ${resolvedExpenseName}`;
      const lines = [
        { accountCode: offsetAcc.code, debit: val, credit: 0, description: `Bank Payout (${resolvedExpenseName}): ${memo}` },
        { accountCode: bankAcc.code, debit: 0, credit: val, description: `Bank Payout (${resolvedExpenseName}): ${memo}` }
      ];

      const prefix = 'BP';
      const timeStr = Date.now().toString().slice(-6);
      const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

      const payload = {
        voucherNo,
        postingDate: new Date(postingDate).toISOString(),
        subsidiary: 'Global',
        reference: reference || `${resolvedExpenseName} Payout`,
        description: memo,
        status: 'Posted',
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

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all font-medium';
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
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-400 bg-brand-950/40 border border-brand-900/40 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> {t('forms.quickAdd')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">{t('forms.addExpense')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('forms.addExpenseDesc')}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20">
          Quick Entry
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="space-y-5 max-w-4xl">

          {/* Card 01: Expense Type */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                  01
                </span>
                <h3 className="text-sm font-semibold text-slate-200">{t('forms.expenseType')}</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'Salary', label: t('forms.sources.salary', 'Salary') },
                    { key: 'Rent', label: t('forms.sources.rent', 'Rent') },
                    { key: 'Fuel', label: t('forms.sources.fuel', 'Fuel') },
                    { key: 'Bus Repair', label: t('forms.sources.busRepair', 'Bus Repair') },
                    { key: 'Generator Repair', label: t('forms.sources.generatorRepair', 'Generator Repair') },
                    { key: 'Legal Fee', label: t('forms.sources.legalFee', 'Legal Fee') },
                    { key: 'Medical Donation', label: t('forms.sources.medicalDonation', 'Medical Donation') },
                    { key: 'Zakat Distribution', label: t('forms.sources.zakatDistribution', 'Zakat Distribution') },
                    { key: 'Other', label: t('forms.sources.other', 'Other') }
                  ].map(type => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setExpenseType(type.key)}
                      className={`py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                        expenseType === type.key
                          ? 'bg-brand-500/10 border-brand-500/60 text-brand-400 font-bold shadow-sm shadow-brand-500/5'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {expenseType === 'Other' && (
                  <div className="mt-4 max-w-md animate-fadeIn">
                    <label className={labelClass}>Other Expense Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Printing and Stationery"
                      value={customExpenseName}
                      onChange={e => setCustomExpenseName(e.target.value)}
                      className={inputClass}
                      required={expenseType === 'Other'}
                      maxLength={40}
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Type the specific name. If a ledger account with this name exists, it will auto-link. Otherwise, a new account will be auto-created under Administrative Expenses.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 02: Ledger Mapping */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                  02
                </span>
                <h3 className="text-sm font-semibold text-slate-200">{t('forms.ledgerMapping')}</h3>
              </div>
              <div className="p-5">
                {matchedAccounts.length > 0 ? (
                  <div>
                    {matchedAccounts.length === 1 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>
                          {t('forms.autoLinkedTo')} <strong className="text-slate-200">{matchedAccounts[0].code} - {matchedAccounts[0].name}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className={labelClass}>{t('forms.selectTargetLedger')}</label>
                        <select
                          value={selectedSubAccountId}
                          onChange={e => setSelectedSubAccountId(e.target.value)}
                          className={inputClass + ' max-w-md'}
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
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-950/60 border border-brand-500/20 text-xs text-slate-300">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-brand-400 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-200">{t('forms.missingSubAccount')}</p>
                        <p className="text-slate-400 leading-relaxed">
                          No ledger account exists for <code className="bg-slate-900 border border-slate-800 text-brand-400 px-1.5 py-0.5 rounded font-mono font-bold">"{expenseType === 'Other' && customExpenseName.trim() ? customExpenseName.trim() : expenseType}"</code>.
                          The system will automatically generate it under <span className="font-semibold text-slate-200">{autoCreationDetails.parentName}</span> with code <code className="bg-slate-900 border border-slate-800 text-brand-400 px-1.5 py-0.5 rounded font-mono font-bold">{autoCreationDetails.nextCode}</code> upon saving.
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Card 03: Transaction Details */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
                <span className="w-6 h-6 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-bold text-xs flex items-center justify-center shrink-0">
                  03
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
                  <label className={labelClass}>{t('forms.paidFromBankCash')}</label>
                  <select
                    value={bankAccountId}
                    onChange={e => setBankAccountId(e.target.value)}
                    className={inputClass}
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

                <div>
                  <label className={labelClass}>{t('forms.voucherAmount')}</label>
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
                  <label className={labelClass}>{t('forms.refChequeNumber')}</label>
                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={t('forms.chqPlaceholder')}
                    pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('forms.voucherDescription')}</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={`Details about this ${expenseType.toLowerCase()} payout...`}
                    className={inputClass + ' resize-none h-24'}
                  />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {creationStatus && (
                <span className="text-xs text-slate-400 animate-pulse mr-auto">
                  {creationStatus}
                </span>
              )}
              <Link to="/bank-vouchers"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors">
                {t('forms.cancel')}
              </Link>
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 text-sm font-bold transition-all shadow-lg shadow-brand-600/15 active:scale-95 disabled:opacity-50 cursor-pointer">
                <Save className="h-4 w-4" />
                {loading ? t('forms.processing') : t('forms.saveAndPost')}
              </button>
            </div>
          </div>
      </form>
    </div>
  );
};
