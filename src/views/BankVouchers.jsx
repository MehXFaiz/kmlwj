import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBankVoucherStore } from '../store/bankVoucherStore';
import { useAuthStore } from '../store/authStore';
import { FileSpreadsheet, Search, Plus, Printer, CheckCircle, XCircle, Trash2, AlertTriangle, Edit, X, Banknote, Building2, Calendar, ArrowUpRight, ArrowDownLeft, FileText, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';
import { showToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';

// Helper to render number to English words for standard printed receipt
const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  
  const makeGroup = (n) => {
    let s = '';
    const hundred = Math.floor(n / 100);
    const ten = n % 100;
    if (hundred > 0) s += a[hundred] + ' Hundred ';
    if (ten > 0) {
      if (ten < 20) s += a[ten] + ' ';
      else s += b[Math.floor(ten / 10)] + ' ' + a[ten % 10] + ' ';
    }
    return s.trim();
  };

  let remainder = num;
  let wordResult = '';
  let groupIndex = 0;
  while (remainder > 0) {
    const chunk = remainder % 1000;
    if (chunk > 0) {
      wordResult = makeGroup(chunk) + ' ' + g[groupIndex] + ' ' + wordResult;
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex++;
  }
  return wordResult.trim() + ' Rupees Only';
};

// Printable Modal
function BankVoucherPrintModal({ voucher, onClose }) {
  const { t } = useTranslation();
  
  const handlePrint = () => {
    window.print();
  };

  const amount = useMemo(() => {
    // Total is sum of debits (which balances credit lines)
    return voucher.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  }, [voucher]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto print:block">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm print:hidden" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block animate-in zoom-in-95 duration-150">
        
        {/* Header - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-200">
              {voucher.voucherType === 'BP' ? t('tables.bankVouchers.printBankPayment') : t('tables.bankVouchers.printBankReceipt')}
            </h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg bg-amber-650 hover:bg-amber-550 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
              <Printer className="h-3.5 w-3.5" /> {t('tables.bankVouchers.print')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div id="print-receipt" className="p-8 space-y-6 overflow-y-auto flex-1 bg-slate-900 text-slate-300 print:bg-white print:text-black print:overflow-visible print:p-0 print:static print:w-full print:block">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-receipt, #print-receipt * {
                visibility: visible !important;
              }
              #print-receipt {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
          `}</style>
          
          <div className="flex justify-between items-start border-b border-slate-800 pb-6 print:border-black print:pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 print:text-black" style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", lineHeight: 1.6 }}>کچھی مسلم لوہار واڈہ ویلفیئر جماعت</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold print:text-black">Kutchi Muslim Loharwada Welfare Jamaat</p>
              <p className="text-xs text-slate-400 font-bold mt-1 print:text-black">
                {voucher.voucherType === 'BP' ? t('tables.bankVouchers.bankPaymentVoucher') : t('tables.bankVouchers.bankReceiptVoucher')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-550 print:text-black">{t('tables.bankVouchers.voucher')} <span className="font-bold text-slate-300 print:text-black">{voucher.voucherNo}</span></div>
              <div className="text-xs text-slate-550 print:text-black mt-1">{t('tables.bankVouchers.date')}: {new Date(voucher.postingDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
              <div className="text-xs text-slate-550 print:text-black mt-1">{t('tables.bankVouchers.referenceCheque')} <span className="font-bold text-slate-350 print:text-black">{voucher.reference}</span></div>
            </div>
          </div>

          {/* Description */}
          {voucher.description && (
            <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-xl print:border-black print:rounded-none print:bg-transparent">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 print:text-black">{t('tables.bankVouchers.remarksMemo')}</h4>
              <p className="text-xs text-slate-350 print:text-black font-semibold">{voucher.description}</p>
            </div>
          )}

          {/* Double-entry rows */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">{t('tables.bankVouchers.accountingLedgerLines')}</h4>
            <div className="rounded-xl border border-slate-850 bg-slate-950/20 overflow-hidden print:border-black print:rounded-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 print:bg-gray-100 print:border-black text-[10px] font-bold uppercase text-slate-500 print:text-black">
                    <th className="px-4 py-2.5">{t('tables.bankVouchers.accountCodeAndName')}</th>
                    <th className="px-4 py-2.5 text-right w-28">{t('tables.bankVouchers.debit')}</th>
                    <th className="px-4 py-2.5 text-right w-28">{t('tables.bankVouchers.credit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 print:divide-black text-xs">
                  {voucher.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-slate-300 print:text-black font-medium">
                        <span className="font-mono text-slate-500 bg-slate-800/25 border border-slate-700/20 px-1 py-0.2 rounded mr-1.5 print:bg-transparent print:border-none print:text-black">{line.accountCode}</span>
                        {line.description || t('tables.bankVouchers.entry')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 print:text-black font-semibold">
                        {line.debit > 0 ? `PKR ${line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 print:text-black font-semibold">
                        {line.credit > 0 ? `PKR ${line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount in words */}
          <div className="bg-slate-950/20 border border-slate-850/60 p-3.5 rounded-xl text-xs print:bg-transparent print:border-black print:rounded-none">
            <span className="font-semibold text-slate-500 print:text-black mr-2 uppercase tracking-wide text-[10px]">{t('tables.bankVouchers.amountInWords')}</span>
            <span className="font-bold text-slate-300 print:text-black italic">{numberToWords(amount)}</span>
          </div>

          {/* Signatures */}
          <div className="pt-10 flex justify-between items-end gap-12 print:pt-8">
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">{t('tables.bankVouchers.preparedBy')}</p>
            </div>
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">{t('tables.bankVouchers.verifiedBy')}</p>
            </div>
            <div className="text-center flex-1">
              <div className="w-32 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider print:text-black">{t('tables.bankVouchers.authorizedSign')}</p>
            </div>
          </div>
        </div>

        {/* Footer actions - Hidden when printing */}
        <div className="bg-slate-955/40 border-t border-slate-800 px-6 py-4 flex justify-end gap-3 shrink-0 print:hidden">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer">
            {t('tables.bankVouchers.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BankVoucherEditModal({ voucher, onClose, onSave }) {
  const [date, setDate] = useState(() => {
    const d = voucher.postingDate || voucher.date;
    return d ? new Date(d).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  });
  const [reference, setReference] = useState(voucher.reference || '');
  const [description, setDescription] = useState(voucher.description || '');
  const [amount, setAmount] = useState(() => {
    const sum = voucher.lines?.reduce((s, l) => s + (l.debit || 0), 0);
    return sum ? sum.toString() : '';
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await onSave({
        id: voucher.dbId || voucher.id,
        postingDate: date,
        reference,
        description,
        amount: Number(amount)
      });
      onClose();
    } catch (err) {
      console.error("Failed to update voucher:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-900/40 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center">
              <Edit className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Edit {voucher.voucherType === 'BP' ? 'Expense' : 'Voucher'} ({voucher.voucherNo})</h3>
              <p className="text-[11px] text-slate-500">Update voucher details & amount</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount (PKR) *</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-mono focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Paid To / Reference</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. Vendor name, Cheque no..."
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description / Memo</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide details..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-amber-500 transition-all resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !amount}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50">
              {loading && <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const BankVouchers = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { vouchers, fetchVouchers, updateVoucher, updateVoucherStatus, deleteVoucher, bulkDeleteVouchers, loading } = useBankVoucherStore();
  const { canEditOrDelete } = useAuthStore();
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('BP'); // BP (Payments), BR (Receipts)
  const [printItem, setPrintItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVouchers(activeTab);
  }, [activeTab, fetchVouchers]);

  const handleSaveEdit = async (updatedData) => {
    try {
      await updateVoucher(updatedData.id, updatedData, activeTab);
      showToast('Voucher updated successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update voucher', 'error');
      throw err;
    }
  };

  const filtered = useMemo(() => {
    return vouchers.filter(v => 
      (v.voucherNo || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [vouchers, search]);

  const getVoucherTotal = (v) => {
    return v.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  };

  const getOffsetAccount = (v) => {
    // For BP: Offset is the debit account (the expense/asset being paid to)
    // For BR: Offset is the credit account (the revenue/liability received from)
    const targetLine = v.lines.find(line => v.voucherType === 'BP' ? line.debit > 0 : line.credit > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const getBankCode = (v) => {
    // For BP: Credit account is the Bank account
    // For BR: Debit account is the Bank account
    const targetLine = v.lines.find(line => v.voucherType === 'BP' ? line.credit > 0 : line.debit > 0);
    return targetLine ? targetLine.accountCode : '—';
  };

  const getVoucherTypeOrRef = (v) => {
    if (v.reference && v.reference !== '—') {
      const cleaned = v.reference.replace(/\s*Payout$/i, '').trim();
      if (cleaned && cleaned !== v.voucherNo) return cleaned;
    }
    if (v.description) {
      const match = v.description.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1];
    }
    const targetLine = v.lines?.find(line => v.voucherType === 'BP' ? line.debit > 0 : line.credit > 0);
    if (targetLine?.accountName) return targetLine.accountName;
    if (targetLine?.description) {
      const match = targetLine.description.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1];
    }
    return v.reference || '—';
  };

  const handlePost = async (id) => {
    setStatusLoading(true);
    try {
      await updateVoucherStatus(id, 'Posted', activeTab);
    } catch (err) {
      alert(err.message || "Failed to post voucher");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Are you sure you want to void this voucher and reverse ledger records?")) return;
    setStatusLoading(true);
    try {
      await updateVoucherStatus(id, 'Cancelled', activeTab);
    } catch (err) {
      alert(err.message || "Failed to cancel voucher");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteVoucher = async (id, voucherNo) => {
    if (!confirm(`Are you sure you want to permanently delete bank voucher ${voucherNo}? This will remove it from the database and adjust account balances.`)) return;
    setStatusLoading(true);
    try {
      await deleteVoucher(id, activeTab);
    } catch (err) {
      alert(err.message || "Failed to delete voucher");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(v => v.dbId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 15));
    try {
      await bulkDeleteVouchers(selectedIds, activeTab);
      showToast(`${selectedIds.length} voucher(s) deleted successfully`, 'success');
      setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to bulk delete vouchers', 'error');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/60 text-slate-400 border-slate-700/50">{t('tables.bankVouchers.draft')}</span>;
      case 'Posted':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/60 text-amber-400 border-amber-900/50">{t('tables.bankVouchers.posted')}</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-950/60 text-red-400 border-red-900/50">{t('tables.bankVouchers.cancelled')}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 bg-amber-950/50 border border-amber-900/60 px-2.5 py-0.5 rounded-full">
              <FileSpreadsheet className="h-3 w-3" /> {t('tables.bankVouchers.cashBankVouchers')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">{t('tables.bankVouchers.bankVouchers')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('tables.bankVouchers.bankVouchersDesc')}</p>
        </div>
        <div className={pageActionsClass}>
          {selectedIds.length > 0 && canEditOrDelete && (
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all shadow-lg active:scale-95 flex-1 sm:flex-none cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}
          {activeTab === 'BR' ? (
            <>
              <Link to="/bank-vouchers/revenue/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> {t('forms.addIncome')}
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                {t('tables.bankVouchers.advancedReceipt')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/bank-vouchers/expense/new"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> {t('forms.addExpense')}
              </Link>
              <Link to="/bank-vouchers/new"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs font-semibold flex-1 sm:flex-none">
                {t('tables.bankVouchers.advancedPayment')}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 scrollbar-none overflow-x-auto whitespace-nowrap">
        <button onClick={() => setActiveTab('BP')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BP' ? 'text-amber-400 border-amber-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          {t('tables.bankVouchers.bankPaymentsBP')}
        </button>
        <button onClick={() => setActiveTab('BR')}
          className={`px-4 py-3 text-xs font-bold transition-all relative border-b-2 -mb-[2px] cursor-pointer ${activeTab === 'BR' ? 'text-amber-400 border-amber-500 font-extrabold' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
          {t('tables.bankVouchers.bankReceiptsBR')}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('tables.bankVouchers.searchPlaceholder') || "Search by voucher #, reference or remarks..."}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
        </div>
        <div className="flex items-center gap-4 self-end sm:self-auto text-xs font-medium text-slate-400 px-2">
          {canEditOrDelete && filtered.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                onChange={handleSelectAll}
                className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer w-4 h-4"
              />
              <span>Select All</span>
            </label>
          )}
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> {filtered.length === 1 ? 'voucher' : 'vouchers'}</span>
        </div>
      </div>

      {/* Grid Card View Container (Reference Style) */}
      <div className="mt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="h-8 w-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">{t('tables.bankVouchers.loadingVouchers') || 'Loading Vouchers...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
              <FileSpreadsheet className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">{search ? 'No vouchers found' : 'No vouchers recorded yet'}</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6">{search ? `We couldn't find any results matching "${search}". Try adjusting your search term or clearing the filter.` : 'Start by recording your first bank payment or receipt voucher to generate accounting entries and ledger records.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(v => (
              <div
                key={v.dbId}
                className={`group relative rounded-2xl border bg-slate-900/90 p-5 shadow-xl hover:shadow-2xl hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between ${
                  selectedIds.includes(v.dbId) ? 'border-amber-500/60 bg-amber-500/5 shadow-amber-500/10' : 'border-slate-800/80'
                }`}
              >
                {/* Card Top: Checkbox, Icon, Voucher No & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      {canEditOrDelete && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(v.dbId)}
                          onChange={(e) => handleSelectOne(v.dbId, e)}
                          className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800/60 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
                        />
                      )}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner shrink-0 border ${
                        v.voucherType === 'BP' 
                          ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 text-amber-400' 
                          : 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/30 text-emerald-400'
                      }`}>
                        {v.voucherType === 'BP' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-amber-400 group-hover:text-amber-300 transition-colors leading-tight tracking-tight font-mono">
                          {v.voucherNo || 'BP-0000'}
                        </h4>
                        <p className="text-xs text-slate-200 font-bold mt-0.5">
                          {getVoucherTypeOrRef(v)}
                        </p>
                        {v.description && (
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-2" title={v.description}>
                            {v.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(v.status)}
                    </div>
                  </div>

                  {/* Inner Details Well */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-4 my-4 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.totalAmount') || 'TOTAL AMOUNT'}
                      </span>
                      <span className="font-bold text-amber-400 text-sm">
                        PKR {getVoucherTotal(v).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.bankAccount') || 'BANK ACCOUNT'}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded">
                        {getBankCode(v)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.offsetAccount') || 'OFFSET ACCOUNT'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800/45 border border-slate-700/40 px-2 py-0.5 rounded">
                        {getOffsetAccount(v)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase text-[11px] font-bold tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" /> {t('tables.bankVouchers.referenceCheque') || 'REFERENCE'}
                      </span>
                      <span className="font-semibold text-slate-200 text-xs truncate max-w-[150px]" title={v.reference}>
                        {v.reference || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Expand Ledger Lines Button */}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === v.dbId ? null : v.dbId)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      {expandedId === v.dbId ? 'Hide Ledger Entries' : 'View Ledger Entries'} ({v.lines ? v.lines.length : 0})
                      {expandedId === v.dbId ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    
                    {expandedId === v.dbId && (
                      <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-950/90 overflow-hidden animate-in fade-in duration-150">
                        <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>{t('tables.bankVouchers.accountCode') || 'ACCOUNT / ENTRY'}</span>
                          <div className="flex gap-4">
                            <span className="w-16 text-right">{t('tables.bankVouchers.debit') || 'DEBIT'}</span>
                            <span className="w-16 text-right">{t('tables.bankVouchers.credit') || 'CREDIT'}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-800/50 max-h-48 overflow-y-auto">
                          {v.lines && v.lines.map(line => (
                            <div key={line.id} className="p-2.5 flex justify-between items-center text-xs">
                              <div className="pr-2 truncate flex-1 font-medium text-slate-300" title={line.description}>
                                <span className="font-mono text-slate-400 bg-slate-800/50 border border-slate-700/40 px-1 py-0.5 rounded mr-1.5 text-[10px]">{line.accountCode}</span>
                                {line.description || t('tables.bankVouchers.entry')}
                              </div>
                              <div className="flex gap-4 shrink-0 font-mono font-semibold">
                                <span className="w-16 text-right text-slate-200">{line.debit > 0 ? line.debit.toLocaleString() : '—'}</span>
                                <span className="w-16 text-right text-slate-200">{line.credit > 0 ? line.credit.toLocaleString() : '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {v.postedBy && (
                          <div className="px-3 py-1.5 bg-slate-900/40 border-t border-slate-800/60 text-[10px] text-slate-400">
                            <span className="font-bold">{t('tables.bankVouchers.postedBy') || 'Posted By'}:</span> {v.postedBy}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Date & Action Icons */}
                <div className="flex items-center justify-between gap-2 pt-3.5 mt-3.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {v.postingDate}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPrintItem(v)} className="w-8 h-8 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer shadow-sm" title="Print physical voucher">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    {(v.status === 'Draft' || canEditOrDelete) && (
                      <button onClick={() => setEditItem(v)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Edit Voucher">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {v.status === 'Draft' && (
                      <button onClick={() => handlePost(v.dbId)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title={t('tables.bankVouchers.post') || "Post Voucher"}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {v.status === 'Posted' && (
                      <button onClick={() => handleCancel(v.dbId)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title={t('tables.bankVouchers.void') || "Void Voucher & Reverse Ledger Entry"}>
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEditOrDelete && (
                      <button onClick={() => handleDeleteVoucher(v.dbId, v.voucherNo)} disabled={statusLoading}
                        className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Delete from database">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {printItem && (
        <BankVoucherPrintModal
          voucher={printItem}
          onClose={() => setPrintItem(null)}
        />
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Confirm Bulk Deletion</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-white">{selectedIds.length}</span> selected bank voucher(s)? Any associated ledger entries and account balances will be automatically re-adjusted. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeBulkDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedIds.length} Voucher(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <BankVoucherEditModal
          voucher={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};
