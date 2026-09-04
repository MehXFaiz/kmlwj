import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, ArrowRightLeft } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { isGenuineBankAccount, isGenuineCashAccount } from '../utils/accountFilters';
import { useTranslation } from 'react-i18next';
import { PhoneInput } from '../components/ui/PhoneInput';
import { CNICInput } from '../components/ui/CNICInput';

export const RevenueEntryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();

  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get('source');

  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');

  // Payment method: CASH or BANK
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [bankAccountId, setBankAccountId] = useState('');

  // Dynamic Chart of Accounts hierarchy selection
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedSubAccountId, setSelectedSubAccountId] = useState('');

  // Booker / Payer Bio-Data
  const [receivedFrom, setReceivedFrom] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');
  const [cnic, setCnic] = useState('');

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  useEffect(() => {
    fetchAccountsList();
  }, [fetchAccountsList]);

  // 1. Dynamic Revenue Parent Categories (Level 2 PARENT accounts under REVENUE 3000000)
  const revenueCategories = useMemo(() => {
    return (flatAccounts || [])
      .filter(acc =>
        (acc.type === 'Revenue' || acc.accountTypeName === 'REVENUE' || (acc.accountType?.name || '').toUpperCase() === 'REVENUE') &&
        acc.level === 'PARENT' &&
        !acc.isDeleted
      )
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [flatAccounts]);

  // Handle URL source parameter matching if provided
  useEffect(() => {
    if (revenueCategories.length > 0 && !selectedParentId) {
      if (sourceParam) {
        const query = sourceParam.toLowerCase();
        const matched = revenueCategories.find(c =>
          (c.name || '').toLowerCase().includes(query) ||
          (query.includes('hall') && (c.name || '').toLowerCase().includes('income')) ||
          (query.includes('other') && (c.name || '').toLowerCase().includes('other')) ||
          (query.includes('decor') && (c.name || '').toLowerCase().includes('decoration'))
        );
        if (matched) {
          setSelectedParentId(matched.id);
          return;
        }
      }
      setSelectedParentId(revenueCategories[0].id);
    }
  }, [revenueCategories, selectedParentId, sourceParam]);

  // 2. Dynamic Subsidiary Accounts under the selected Parent Category
  const subsidiaryAccounts = useMemo(() => {
    if (!selectedParentId) return [];
    const parent = revenueCategories.find(c => c.id === selectedParentId);
    if (!parent) return [];

    return (flatAccounts || [])
      .filter(acc =>
        (acc.type === 'Revenue' || acc.accountTypeName === 'REVENUE' || (acc.accountType?.name || '').toUpperCase() === 'REVENUE') &&
        (acc.level === 'SUBSIDIARY' || acc.level === 'GL') &&
        !acc.isDeleted &&
        (acc.parentId === parent.id || acc.parentCode === parent.code)
      )
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [flatAccounts, revenueCategories, selectedParentId]);

  // Default to first subsidiary account when category changes
  useEffect(() => {
    if (subsidiaryAccounts.length > 0) {
      const currentValid = subsidiaryAccounts.some(s => s.id === selectedSubAccountId);
      if (!currentValid) {
        setSelectedSubAccountId(subsidiaryAccounts[0].id);
      }
    } else {
      setSelectedSubAccountId('');
    }
  }, [subsidiaryAccounts, selectedSubAccountId]);

  // Authorized Asset Bank Accounts
  const authorizedBankAccounts = useMemo(() => {
    return (flatAccounts || []).filter(isGenuineBankAccount);
  }, [flatAccounts]);

  const cashInHandAccount = useMemo(() => {
    return (flatAccounts || []).find(isGenuineCashAccount);
  }, [flatAccounts]);

  // Set default bank or cash account
  useEffect(() => {
    if (paymentMethod === 'BANK') {
      if (authorizedBankAccounts.length > 0) {
        const currentValid = authorizedBankAccounts.some(a => a.id === bankAccountId);
        if (!currentValid) {
          setBankAccountId(authorizedBankAccounts[0].id);
        }
      }
    } else {
      if (cashInHandAccount) {
        setBankAccountId(cashInHandAccount.id);
      }
    }
  }, [paymentMethod, authorizedBankAccounts, cashInHandAccount, bankAccountId]);

  const selectedCategory = useMemo(() => {
    return revenueCategories.find(c => c.id === selectedParentId);
  }, [revenueCategories, selectedParentId]);

  const selectedSubAccount = useMemo(() => {
    return subsidiaryAccounts.find(s => s.id === selectedSubAccountId);
  }, [subsidiaryAccounts, selectedSubAccountId]);

  const activeDebitAccount = useMemo(() => {
    if (paymentMethod === 'BANK') {
      return authorizedBankAccounts.find(a => a.id === bankAccountId);
    }
    return cashInHandAccount;
  }, [paymentMethod, bankAccountId, authorizedBankAccounts, cashInHandAccount]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (!selectedSubAccount) {
      showToast('Please select a subsidiary revenue account.', 'warning');
      return;
    }

    if (!activeDebitAccount) {
      showToast('Please select a valid bank or cash account.', 'warning');
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
    if (val > 100000000) {
      showToast('Amount cannot exceed 100,000,000.', 'warning');
      return;
    }

    setLoading(true);
    try {
      setCreationStatus("Posting double-entry transaction to ledger...");

      const bioParts = [
        receivedFrom && `Received From: ${receivedFrom}`,
        fatherName && `Father: ${fatherName}`,
        cnic && `CNIC: ${cnic}`,
        mobile && `Ph: ${mobile}`,
        description
      ].filter(Boolean);

      const memo = bioParts.join(' | ') || `Income received for ${selectedSubAccount.name}`;
      const prefix = paymentMethod === 'BANK' ? 'BR' : 'CR';
      const timeStr = Date.now().toString().slice(-6);
      const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

      // Double-entry transaction:
      // DEBIT: Bank Account / Cash in Hand (Asset)
      // CREDIT: Selected Revenue Subsidiary Account (Revenue)
      const lines = [
        {
          accountCode: activeDebitAccount.code,
          debit: val,
          credit: 0,
          description: `${prefix === 'BR' ? 'Bank' : 'Cash'} Receipt (${selectedSubAccount.name}): ${memo}`
        },
        {
          accountCode: selectedSubAccount.code,
          debit: 0,
          credit: val,
          description: `${prefix === 'BR' ? 'Bank' : 'Cash'} Receipt (${selectedSubAccount.name}): ${memo}`
        }
      ];

      const payload = {
        voucherNo,
        postingDate: new Date(postingDate).toISOString(),
        subsidiary: 'Global',
        reference: reference || `${selectedSubAccount.name} Receipt`,
        description: memo,
        status: 'Posted',
        voucherType: prefix,
        lines
      };

      await addVoucher(payload);
      showToast('Income recorded and posted to the General Ledger!', 'success');
      navigate('/bank-vouchers');
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Couldn't save the revenue entry. Please try again.";
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
      setCreationStatus('');
    }
  };

  const inputClass = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition-all font-medium';
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
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> Quick Add
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">Add Income Entry</h1>
            <p className="text-xs text-slate-500 mt-0.5">Dynamic Chart of Accounts Revenue Entry</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
          Double-Entry Posting
        </span>
      </div>

      <form onSubmit={handleSave}>
        <div className="space-y-5 max-w-4xl">

          {/* Card 01: Dynamic Category & Subsidiary Selection */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
              <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                01
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Income Account Hierarchy (Chart of Accounts)</h3>
                <p className="text-[11px] text-slate-400">Select Parent Category then Subsidiary Revenue Account</p>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>1. Income Category (Parent) *</label>
                <select
                  value={selectedParentId}
                  onChange={e => setSelectedParentId(e.target.value)}
                  className={inputClass}
                  required
                >
                  {revenueCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.code} - {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>2. Subsidiary Revenue Account (Credit) *</label>
                <select
                  value={selectedSubAccountId}
                  onChange={e => setSelectedSubAccountId(e.target.value)}
                  className={inputClass}
                  required
                  disabled={subsidiaryAccounts.length === 0}
                >
                  {subsidiaryAccounts.length === 0 ? (
                    <option value="">No subsidiary accounts under this category</option>
                  ) : (
                    subsidiaryAccounts.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Card 02: Payer / Booker Details */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
              <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                02
              </span>
              <h3 className="text-sm font-semibold text-slate-200">Payer / Source Details (جس سے رقم وصول ہوئی)</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Received From (Payer Name)</label>
                <input
                  type="text"
                  value={receivedFrom}
                  onChange={e => setReceivedFrom(e.target.value)}
                  placeholder="e.g. Muhammad Bilal"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Father / Husband Name</label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={e => setFatherName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>CNIC Number</label>
                <CNICInput
                  value={cnic}
                  onChange={e => setCnic(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone / Mobile Number</label>
                <PhoneInput
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Card 03: Receipt & Payment Method */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
              <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                03
              </span>
              <h3 className="text-sm font-semibold text-slate-200">Receipt & Account Details</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Transaction Date</label>
                <input
                  type="date"
                  value={postingDate}
                  onChange={e => setPostingDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Payment Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      paymentMethod === 'BANK'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bank Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      paymentMethod === 'CASH'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Cash in Hand
                  </button>
                </div>
              </div>

              {paymentMethod === 'BANK' ? (
                <div>
                  <label className={labelClass}>Bank Account * (Authorized Banks Only)</label>
                  <select
                    value={bankAccountId}
                    onChange={e => setBankAccountId(e.target.value)}
                    className={inputClass}
                    required
                  >
                    {authorizedBankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} (Avail: Rs {Number(acc.currentBalance || 0).toLocaleString('en-PK')})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Cash Account *</label>
                  <input
                    type="text"
                    readOnly
                    value={`${cashInHandAccount?.code || '1010103'} - ${cashInHandAccount?.name || 'Cash in Hand'}`}
                    className={inputClass + ' opacity-80 cursor-not-allowed bg-slate-900'}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Amount (PKR) *</label>
                <input
                  type="text"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  pattern="^[1-9]\d*(\.\d{1,2})?$"
                  title="Positive number with up to 2 decimal places"
                  className={inputClass}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Reference / Cheque / Deposit Slip Number</label>
                <input
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="Deposit Slip / Online Ref / Cheque No"
                  pattern="^[a-zA-Z0-9\s.-]{3,30}$"
                  title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Description / Remarks</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional details regarding this income receipt..."
                  className={inputClass + ' resize-none h-20'}
                />
              </div>
            </div>

            {/* Live Double-Entry Preview */}
            <div className="px-5 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs flex-wrap gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <ArrowRightLeft className="h-4 w-4 text-amber-400" />
                <span className="font-semibold">Double Entry:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  DEBIT {activeDebitAccount ? `${activeDebitAccount.code} (${activeDebitAccount.name})` : 'Bank/Cash'}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-amber-400 font-mono font-bold">
                  CREDIT {selectedSubAccount ? `${selectedSubAccount.code} (${selectedSubAccount.name})` : 'Revenue Account'}
                </span>
              </div>
              <div className="text-amber-400 font-bold text-sm">
                Rs {amount ? Number(amount).toLocaleString('en-PK') : '0'}
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
            <button
              type="submit"
              disabled={loading || !selectedSubAccount}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-all shadow-lg shadow-amber-500/15 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {loading ? t('forms.processing') : 'Save & Post Income'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
