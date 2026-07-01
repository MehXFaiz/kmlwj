import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCoaStore } from '../store/coaStore';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { ChevronLeft, Save, Sparkles, Plus, AlertCircle, CheckCircle } from 'lucide-react';
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
      if (acc.type !== 'Revenue' || acc.detailType !== 'Subsidiary') return false;
      const nameLower = (acc.name || '').toLowerCase();
      
      switch (revenueSource) {
        case 'Hall Booking':
          // parent is Hall Income (3100000) or contains Hall/Garden
          return acc.parentCode === '3100000' || nameLower.includes('hall') || nameLower.includes('garden');
        case 'Donation':
          // parent is Donations (3200000) or contains Donation (but try to avoid specific zakat/fitra if possible, or include all)
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
      // Find if we already have one selected, or default to the first one
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
        parentCode = '3200000';
        parentName = 'Donations';
        name = 'General Donation';
        break;
      case 'Zakat':
        parentCode = '3200000';
        parentName = 'Donations';
        name = 'Zakat Revenue';
        break;
      case 'Fitra':
        parentCode = '3200000';
        parentName = 'Donations';
        name = 'Fitra Revenue';
        break;
      case 'Membership Fee':
        parentCode = '3300000';
        parentName = 'Other Income';
        name = 'Membership Fee Revenue';
        break;
      case 'Bus Booking':
        parentCode = '3300000';
        parentName = 'Other Income';
        name = 'Bus Booking Revenue';
        break;
      case 'Hall Booking':
        parentCode = '3100000';
        parentName = 'Hall Income';
        name = 'General Hall Booking';
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
  }, [revenueSource, matchedAccounts, flatAccounts]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bankAccountId) {
      showToast('Please select a cash or bank account first.', 'warning');
      return;
    }

    const val = parseFloat(amount);
    if (!val || val <= 0) {
      showToast('Please enter a valid amount greater than zero.', 'warning');
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

      // Re-fetch list to ensure states are aligned (or find it from the returned newAcc)
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
        status: 'Posted', // Post immediately to ledger
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link to="/bank-vouchers" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" /> {t('forms.quickAdd')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('forms.addRevenue')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('forms.addRevenueDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 sm:p-6 space-y-6">
        
        {/* Revenue Source selection */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('forms.revenueSource')}</label>
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
                className={`py-3 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                  revenueSource === src.key
                    ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>
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
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors flex items-center gap-1 flex-shrink-0"
          >
            Go to {revenueSource} Section →
          </Link>
        </div>

        {/* Dynamic Mapping Info / Sub-Selectors */}
        <div className="p-4 rounded-lg bg-slate-950/30 border border-slate-850 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550 block">{t('forms.ledgerMapping')}</span>
          
          {matchedAccounts.length > 0 ? (
            <div>
              {matchedAccounts.length === 1 ? (
                <div className="flex items-center gap-2 text-xs text-slate-350">
                  <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span>
                    {t('forms.autoLinkedTo')} <strong className="text-slate-200">{matchedAccounts[0].code} - {matchedAccounts[0].name}</strong>
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    {revenueSource === 'Hall Booking' ? t('forms.selectHall') : t('forms.selectTargetLedger')}
                  </label>
                  <select
                    value={selectedSubAccountId}
                    onChange={e => setSelectedSubAccountId(e.target.value)}
                    className="w-full max-w-md px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/60 transition-all"
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
              <div className="flex items-start gap-3 p-3 rounded bg-amber-950/20 border border-amber-900/30 text-xs text-amber-300">
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

        {/* Transaction Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.transactionDate')}</label>
            <input 
              type="date" 
              value={postingDate} 
              onChange={e => setPostingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/50 transition-colors" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.depositBankCash')}</label>
            <select 
              value={bankAccountId} 
              onChange={e => setBankAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/50 transition-colors"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.revenueAmount')}</label>
            <input 
              type="number" 
              min="0" 
              step="any" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/50 transition-colors placeholder-slate-600 font-semibold" 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.refChequeReceipt')}</label>
            <input 
              value={reference} 
              onChange={e => setReference(e.target.value)} 
              placeholder={t('forms.refPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/50 transition-colors placeholder-slate-600" 
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('forms.voucherDescription')}</label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder={`Details about this ${revenueSource.toLowerCase()} receipt...`}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-slate-200 text-sm focus:outline-none focus:border-emerald-600/50 transition-colors h-24 resize-none placeholder-slate-600" 
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
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer">
            <Save className="h-4 w-4" />
            {loading ? t('forms.processing') : t('forms.saveAndPost')}
          </button>
        </div>
      </form>
    </div>
  );
};
