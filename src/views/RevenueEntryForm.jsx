import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

export const RevenueEntryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatAccounts, fetchAccountsList, addAccount } = useCoaStore();
  const { addVoucher } = useBankVoucherStore();

  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  // Selected high-level revenue source
  const [revenueSource, setRevenueSource] = useState('Hall Booking');

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

  // Map high-level sources to filters
  const matchedAccounts = useMemo(() => {
    if (!revenueSource) return [];

    return flatAccounts.filter(acc => {
      if ((acc.type !== 'Revenue' && acc.accountTypeName !== 'REVENUE') || (acc.level !== 'SUBSIDIARY' && acc.detailType !== 'Subsidiary' && acc.detailType !== 'Revenue')) return false;
      const nameLower = (acc.name || '').toLowerCase();

      switch (revenueSource) {
        case 'Hall Booking':
          return (
            nameLower.includes('bagh') || nameLower.includes('hajiani') || nameLower.includes('hajiyani') ||
            nameLower.includes('sadaya') || nameLower.includes('sada') ||
            nameLower.includes('zikarya') || nameLower.includes('zikriya') || nameLower.includes('zakaria') || nameLower.includes('zakriya') ||
            nameLower.includes('annexy') || nameLower.includes('anexy') || nameLower.includes('gosha') || nameLower.includes('anxy')
          );
        case 'Donation':
          return (acc.parentCode === '3200000' || nameLower.includes('donation')) && !nameLower.includes('zakat') && !nameLower.includes('fitra');
        case 'Membership Fee':
          return nameLower.includes('membership') || nameLower.includes('member');
        case 'Bus Booking':
          return nameLower.includes('bus');
        case 'Zakat':
          return nameLower.includes('zakat');
        case 'Fitra':
          return nameLower.includes('fitra') || nameLower.includes('fitrah');
        default:
          return false;
      }
    });
  }, [revenueSource, flatAccounts]);

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
  }, [matchedAccounts, selectedSubAccountId, revenueSource]);

  // Details for account auto-creation if no matches found
  const autoCreationDetails = useMemo(() => {
    if (matchedAccounts.length > 0) return null;

    let parentCode = '';
    let name = '';
    let parentName = '';

    switch (revenueSource) {
      case 'Donation':
        parentCode = '3200000'; parentName = 'Donations'; name = 'General Donation'; break;
      case 'Zakat':
        parentCode = '3200000'; parentName = 'Donations'; name = 'Zakat Revenue'; break;
      case 'Fitra':
        parentCode = '3200000'; parentName = 'Donations'; name = 'Fitra Revenue'; break;
      case 'Membership Fee':
        parentCode = '3300000'; parentName = 'Other Income'; name = 'Membership Fee Revenue'; break;
      case 'Bus Booking':
        parentCode = '3300000'; parentName = 'Other Income'; name = 'Bus Booking Revenue'; break;
      case 'Hall Booking':
        parentCode = '3100000'; parentName = 'Hall Income'; name = 'General Hall Booking'; break;
      default:
        return null;
    }

    // Auto-calculate GL code
    const siblings = flatAccounts.filter(a => a.parentCode === parentCode);
    const sibNumeric = siblings.map(a => parseInt(a.code, 10)).filter(Number.isFinite);
    const sibMax = sibNumeric.length ? Math.max(...sibNumeric) : parseInt(parentCode, 10);
    const nextCode = String(sibMax + 1).padStart(7, '0');

    return { parentCode, parentName, name, nextCode };
  }, [revenueSource, matchedAccounts, flatAccounts]);

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
          type: 'Revenue',
          detailType: 'Revenue',
          parentCode: autoCreationDetails.parentCode,
          currency: 'PKR',
          description: `Auto-generated for ${revenueSource} revenue entries.`,
          initialBalance: 0,
        });

        finalOffsetAccountId = newAcc.id;
        finalOffsetAccountCode = newAcc.glCode;
      }

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

      // Build double-entry lines
      // Debit: Bank Account (Asset)
      // Credit: Offset Account (Revenue Subsidiary)
      const memo = description || `Received for ${revenueSource}`;
      const lines = [
        { accountCode: bankAcc.code, debit: val, credit: 0, description: `Bank Receipt (${revenueSource}): ${memo}` },
        { accountCode: offsetAcc.code, debit: 0, credit: val, description: `Bank Receipt (${revenueSource}): ${memo}` }
      ];

      const prefix = 'BR';
      const timeStr = Date.now().toString().slice(-6);
      const voucherNo = `${prefix}-${new Date(postingDate).getFullYear().toString().slice(-2)}${(new Date(postingDate).getMonth() + 1).toString().padStart(2, '0')}-${timeStr}`;

      const payload = {
        voucherNo,
        postingDate: new Date(postingDate).toISOString(),
        subsidiary: 'Global',
        reference: reference || `${revenueSource} Receipt`,
        description: memo,
        status: 'Posted',
        voucherType: 'BR',
        lines
      };

      await addVoucher(payload);
      showToast('Income recorded and posted to your accounts!', 'success');
      navigate('/bank-vouchers');
    } catch (err) {
      showToast(err.message || "Couldn't save the revenue entry. Please try again.", 'error');
    } finally {
      setLoading(false);
      setCreationStatus('');
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
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> {t('forms.quickAdd')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100">{t('forms.addRevenue')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('forms.addRevenueDesc')}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
          Quick Entry
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Card 01: Revenue Source */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
            <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
              01
            </span>
            <h3 className="text-sm font-semibold text-slate-200">{t('forms.revenueSource')}</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'Hall Booking', label: t('forms.sources.hallBooking') },
                { key: 'Donation', label: t('forms.sources.donation') },
                { key: 'Membership Fee', label: t('forms.sources.membershipFee') },
                { key: 'Bus Booking', label: t('forms.sources.busBooking') },
                { key: 'Zakat', label: t('forms.sources.zakat') },
                { key: 'Fitra', label: t('forms.sources.fitra') }
              ].map(src => (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => setRevenueSource(src.key)}
                  className={`py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                    revenueSource === src.key
                      ? 'bg-emerald-600/10 border-emerald-500/60 text-emerald-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>

            {/* Dedicated Section Helper Link */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong>Looking for detailed {revenueSource} records?</strong> Each category now has its own dedicated module with custom fields, receipt printing, and ledger automation!
                </span>
              </div>
              <Link
                to={
                  revenueSource === 'Donation' ? '/donations' :
                  revenueSource === 'Hall Booking' ? '/hall-bookings' :
                  revenueSource === 'Zakat' ? '/zakat' :
                  revenueSource === 'Fitra' ? '/fitra' :
                  revenueSource === 'Membership Fee' ? '/membership-fees' : '/bus-bookings'
                }
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors flex items-center gap-1 flex-shrink-0"
              >
                Go to {revenueSource} Section →
              </Link>
            </div>
          </div>
        </div>

        {/* Card 02: Ledger Mapping */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-800/40">
            <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
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
                    <label className={labelClass}>
                      {revenueSource === 'Hall Booking' ? t('forms.selectHall') : t('forms.selectTargetLedger')}
                    </label>
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
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/30 text-xs text-amber-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-200">{t('forms.missingSubAccount')}</p>
                    <p className="text-amber-400/90 leading-relaxed">
                      No ledger account exists for <strong className="text-white">"{revenueSource}"</strong>.
                      The system will automatically generate it under <strong className="text-white">{autoCreationDetails.parentName}</strong> with code <strong className="font-mono text-white">{autoCreationDetails.nextCode}</strong> upon saving.
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
            <span className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
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
              <label className={labelClass}>{t('forms.depositBankCash')}</label>
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
              <label className={labelClass}>{t('forms.revenueAmount')}</label>
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
              <label className={labelClass}>{t('forms.refChequeReceipt')}</label>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder={t('forms.refPlaceholder')}
                pattern="^[a-zA-Z0-9\s.-]{3,30}$" title="Only letters, numbers, spaces, hyphens, and dots (3-30 characters)"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>{t('forms.voucherDescription')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={`Details about this ${revenueSource.toLowerCase()} receipt...`}
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
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer">
            <Save className="h-4 w-4" />
            {loading ? t('forms.processing') : t('forms.saveAndPost')}
          </button>
        </div>
      </form>
    </div>
  );
};
