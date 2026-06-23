import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDonationStore } from '../store/donationStore';
import { useBeneficiaryStore } from '../store/beneficiaryStore';
import { useCoaStore } from '../store/coaStore';
import { Heart, Search, Plus, Edit2, Trash2, CheckCircle2, X, AlertTriangle, Printer } from 'lucide-react';
import { MobileOnly, DesktopOnly, pageActionsClass } from '../components/common/responsive';

function DonationModal({ isOpen, onClose, onSave, initial, beneficiaries, accounts }) {
  const [form, setForm] = useState(
    initial || { beneficiaryId: '', donationType: 'MONTHLY', amount: '', paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '' }
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initial || { beneficiaryId: '', donationType: 'MONTHLY', amount: '', paymentMethod: 'CASH', bankAccountId: '', chequeNumber: '', donorBankName: '', remarks: '' });
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.beneficiaryId || !form.amount || !form.paymentMethod) return;
    onSave({ ...form });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-pink-950/60 border border-pink-800/40 flex items-center justify-center">
              <Heart className="h-4 w-4 text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">{initial ? 'Edit Donation' : 'New Donation'}</h3>
              <p className="text-[11px] text-slate-500">Log a new donation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Beneficiary *</label>
            <select value={form.beneficiaryId} onChange={e => setForm(f => ({ ...f, beneficiaryId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
              <option value="">Select Beneficiary</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>{b.name} {b.cnic ? `(${b.cnic})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Donation Type *</label>
              <select value={form.donationType} onChange={e => setForm(f => ({ ...f, donationType: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
                {['MONTHLY', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION', 'CUSTOM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="10000" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Method *</label>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value, bankAccountId: '', chequeNumber: '', donorBankName: '' }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all">
              {['CASH', 'BANK', 'CHEQUE'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Account *</label>
                <select value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all">
                  <option value="">Select Bank Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.accountName}</option>
                  ))}
                </select>
              </div>
              {form.paymentMethod === 'CHEQUE' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cheque Number *</label>
                  <input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))}
                    placeholder="CHQ-001" className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all" />
                </div>
              )}
            </div>
          )}

          {(form.paymentMethod === 'BANK' || form.paymentMethod === 'CHEQUE') && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Donor Bank (Pakistani Banks)</label>
              <select value={form.donorBankName} onChange={e => setForm(f => ({ ...f, donorBankName: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all">
                <option value="">Select Bank (Optional)</option>
                {['Habib Bank Limited (HBL)', 'National Bank of Pakistan (NBP)', 'Meezan Bank', 'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank Limited (ABL)', 'Bank Alfalah', 'Standard Chartered Bank', 'Askari Bank', 'Bank AL Habib', 'Faysal Bank', 'Soneri Bank', 'Bank of Punjab (BOP)', 'JS Bank', 'Dubai Islamic Bank', 'Al Baraka Bank', 'Bank Islami', 'Sindh Bank', 'Habib Metropolitan Bank', 'First Women Bank', 'Samba Bank', 'Silkbank', 'Summit Bank'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Remarks</label>
            <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm focus:border-pink-600/60 transition-all h-20 resize-none" />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={!form.beneficiaryId || !form.amount || (form.paymentMethod !== 'CASH' && !form.bankAccountId) || (form.paymentMethod === 'CHEQUE' && !form.chequeNumber)}
            className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-lg shadow-pink-900/40">
            {initial ? 'Save Changes' : 'Create Donation'}
          </button>
        </div>
      </div>
    </div>
  );
}

const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const g = [
    '', 'Thousand', 'Million', 'Billion', 'Trillion'
  ];
  
  const makeGroup = (n) => {
    let s = '';
    const hundred = Math.floor(n / 100);
    const ten = n % 100;
    if (hundred > 0) {
      s += a[hundred] + ' Hundred ';
    }
    if (ten > 0) {
      if (ten < 20) {
        s += a[ten] + ' ';
      } else {
        s += b[Math.floor(ten / 10)] + ' ' + a[ten % 10] + ' ';
      }
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

function DonationInvoiceModal({ donation, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto print:block">
      {/* Background backdrop - hidden when printing */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm print:hidden animate-fade-in" onClick={onClose} />
      
      {/* Invoice Box */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block">
        
        {/* Header - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-pink-400" />
            <h3 className="text-sm font-bold text-slate-200">Donation Receipt / Invoice</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg bg-pink-650 hover:bg-pink-550 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none">
              <Printer className="h-3.5 w-3.5" /> Print Invoice
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-slate-900 text-slate-300 print:bg-white print:text-black print:overflow-visible print:p-0 print:static print:w-full print:block">
          
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-6 gap-4 print:border-black print:pb-4 print:flex-row print:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100 print:text-black" style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", lineHeight: 1.6 }}>کچھی مسلم لوہار واڈہ ویلفیئر جماعت</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold print:text-black">Kutchi Muslim Loharwada Welfare Jamaat</p>
              <p className="text-xs text-slate-400 print:text-black">Official Donation Receipt</p>
            </div>
            <div className="text-left sm:text-right print:text-right">
              <div className="text-xs font-mono text-slate-550 print:text-black">RECEIPT ID: <span className="font-bold text-slate-300 print:text-black">{donation.id.slice(0, 8).toUpperCase()}</span></div>
              <div className="text-xs text-slate-550 print:text-black mt-1">Date: {new Date(donation.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
              <div className="mt-1.5">
                {donation.status === 'APPROVED' ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/50 print:bg-gray-100 print:text-black print:border-black">APPROVED RECEIPT</span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900/50 print:bg-gray-100 print:text-black print:border-black">PENDING VERIFICATION</span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:grid">
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">Beneficiary Details</h4>
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-1.5 print:bg-transparent print:border-black print:rounded-none">
                <p className="text-xs font-bold text-slate-350 print:text-black">{donation.beneficiary?.name}</p>
                <p className="text-[11px] text-slate-500 print:text-black">CNIC: {donation.beneficiary?.cnic || '—'}</p>
                <p className="text-[11px] text-slate-500 print:text-black">Mobile: {donation.beneficiary?.mobile || '—'}</p>
                <p className="text-[11px] text-slate-550 print:text-black truncate">Address: {donation.beneficiary?.address || '—'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">Receipt Reference</h4>
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-1.5 print:bg-transparent print:border-black print:rounded-none">
                <p className="text-xs font-bold text-slate-350 print:text-black">Fund Allocation: {donation.donationType}</p>
                <p className="text-[11px] text-slate-500 print:text-black">Method: {donation.paymentMethod}</p>
                {(donation.paymentMethod === 'CHEQUE' || donation.paymentMethod === 'BANK') && (
                  <>
                    <p className="text-[11px] text-slate-500 print:text-black">Bank Name: {donation.donorBankName || '—'}</p>
                    <p className="text-[11px] text-slate-500 print:text-black">Cheque/Ref No: {donation.chequeNumber || '—'}</p>
                  </>
                )}
                <p className="text-[11px] text-slate-550 print:text-black">Recorded by: {donation.createdBy?.fullName || 'Operator'}</p>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider print:text-black">Itemized Breakdown</h4>
            <div className="rounded-xl border border-slate-850 bg-slate-950/20 overflow-hidden print:border-black print:rounded-none">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 print:bg-gray-100 print:border-black">
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 print:text-black">Description</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 text-right print:text-black">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 print:divide-black">
                  <tr>
                    <td className="px-4 py-3.5 text-xs text-slate-350 print:text-black">
                      Welfare distribution contribution allocated to {donation.donationType} fund.
                      {donation.remarks && <div className="text-[10px] text-slate-500 print:text-black mt-1">Memo: {donation.remarks}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-bold text-right text-slate-200 print:text-black">PKR {donation.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-slate-950/40 print:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-400 print:text-black">Total Receipt Amount</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-right text-slate-200 print:text-black">PKR {donation.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount in words */}
          <div className="bg-slate-950/20 border border-slate-850/60 p-3.5 rounded-xl text-xs print:bg-transparent print:border-black print:rounded-none">
            <span className="font-semibold text-slate-500 print:text-black mr-2 uppercase tracking-wide text-[10px]">Amount in Words:</span>
            <span className="font-bold text-slate-300 print:text-black italic">{numberToWords(donation.amount)}</span>
          </div>

          {/* Authorized Signature section */}
          <div className="pt-10 flex justify-between items-end gap-12 print:pt-8 print:flex print:justify-between">
            <div className="text-center">
              <div className="w-40 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider print:text-black">Receiver Signature</p>
            </div>
            <div className="text-center">
              <div className="w-40 border-b border-slate-800 print:border-black mb-1.5 mx-auto"></div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider print:text-black">Authorized Signature</p>
            </div>
          </div>

          {/* computer generated notice */}
          <div className="pt-6 text-center text-[9px] text-slate-600 border-t border-slate-900/60 print:border-black print:text-black">
            This is a computer-generated donation receipt issued by Kutchi Muslim Loharwada Welfare Jamaat ERP system. No physical signature is required.
          </div>
        </div>

        {/* Footer actions - Hidden when printing */}
        <div className="bg-slate-955/40 border-t border-slate-800 px-6 py-4 flex justify-end gap-3 shrink-0 print:hidden">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer">
            Close
          </button>
          <button onClick={handlePrint} className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-pink-900/25">
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Global CSS to handle hide-everything-on-print */}
      <style>{`
        @media print {
          /* Hide everything except the modal content */
          body > :not(#root) {
            display: none !important;
          }
          /* Standard print style to hide sidebar and topbar */
          header, nav, aside, footer, button, .print-hidden, .print\\:hidden {
            display: none !important;
          }
          /* Ensure modal occupies top left without overlays */
          .fixed {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .bg-black\\/70, .backdrop-blur-sm {
            display: none !important;
          }
          .shadow-2xl, .rounded-2xl {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export const Donations = () => {
  const { donations, fetchDonations, addDonation, updateDonation, approveDonation } = useDonationStore();
  const { beneficiaries, fetchBeneficiaries } = useBeneficiaryStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [approveId, setApproveId] = useState(null);
  const [printDonation, setPrintDonation] = useState(null);

  useEffect(() => {
    fetchDonations();
    fetchBeneficiaries();
    fetchAccountsList();
  }, [fetchDonations, fetchBeneficiaries, fetchAccountsList]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
    }
  }, [searchParams]);

  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(a => (a.name || '').toLowerCase().includes('bank') || (a.type || '').toLowerCase().includes('bank'));
  }, [flatAccounts]);

  const filtered = useMemo(() => {
    return donations.filter(d => 
      (d.beneficiary?.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (d.donationType || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.paymentMethod || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [donations, search]);

  const handleSave = async (data) => {
    if (editItem) {
      await updateDonation(editItem.id, data);
    } else {
      await addDonation(data);
    }
    setEditItem(null);
  };

  const handleApprove = async (id) => {
    await approveDonation(id);
    setApproveId(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-400 bg-pink-950/50 border border-pink-900/60 px-2.5 py-0.5 rounded-full">
              <Heart className="h-3 w-3" /> Donation Management
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Donations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage and approve charitable donations</p>
        </div>

        <div className={pageActionsClass}>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-900/40 transition-all flex-1 sm:flex-none">
            <Plus className="h-4 w-4" /> Log Donation
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search donations..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-pink-600/50 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
        <DesktopOnly>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Beneficiary</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Method</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500">Created</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-200">{d.beneficiary?.name}</p></td>
                    <td className="px-4 py-3.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800/50 text-slate-300 border-slate-700/40">{d.donationType}</span></td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-200">{d.amount.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      <div>{d.paymentMethod}</div>
                      {(d.paymentMethod === 'CHEQUE' || d.paymentMethod === 'BANK') && (d.donorBankName || d.chequeNumber) && (
                        <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                          {d.donorBankName} {d.chequeNumber ? `#${d.chequeNumber}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {d.status === 'APPROVED' ? (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-900/50">Approved</span>
                      ) : (
                         <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-950/60 text-amber-400 border-amber-900/50">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPrintDonation(d)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer" title="Print Invoice / Receipt">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {d.status === 'PENDING' && (
                          <>
                            <button onClick={() => setApproveId(d.id)} className="p-1.5 rounded-lg hover:bg-emerald-950/40 text-emerald-500 hover:text-emerald-400 cursor-pointer" title="Approve">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setEditItem(d); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-200 cursor-pointer">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DesktopOnly>
        <MobileOnly className="p-3 space-y-3">
            {filtered.map(d => (
              <div key={d.id} className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-slate-200">{d.beneficiary?.name}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${d.status === 'APPROVED' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' : 'bg-amber-950/60 text-amber-400 border-amber-900/50'}`}>{d.status}</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">{d.donationType} | {d.paymentMethod} | <span className="font-bold text-slate-200">{d.amount.toLocaleString()}</span></div>
                
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/50">
                  <button onClick={() => setPrintDonation(d)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
                    <Printer className="h-3.5 w-3.5" /> Print Invoice
                  </button>
                  {d.status === 'PENDING' && (
                    <div className="flex gap-3">
                       <button onClick={() => { setEditItem(d); setModalOpen(true); }} className="text-xs text-slate-400 hover:text-white cursor-pointer">Edit</button>
                       <button onClick={() => setApproveId(d.id)} className="text-xs text-emerald-450 hover:text-emerald-400 font-bold flex items-center gap-1 cursor-pointer"><CheckCircle2 className="h-3 w-3" /> Approve</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </MobileOnly>
      </div>

      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApproveId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-emerald-900/50 bg-slate-900 p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-200 mb-2">Approve Donation</h4>
            <p className="text-xs text-slate-400 mb-4">This will generate a Journal Entry and update Ledger balances automatically. Proceed?</p>
            <div className="flex gap-3">
              <button onClick={() => setApproveId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold cursor-pointer">Cancel</button>
              <button onClick={() => handleApprove(approveId)} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">Approve</button>
            </div>
          </div>
        </div>
      )}

      <DonationModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSave={handleSave} initial={editItem} beneficiaries={beneficiaries} accounts={bankAccounts} />

      {printDonation && (
        <DonationInvoiceModal
          donation={printDonation}
          onClose={() => setPrintDonation(null)}
        />
      )}
    </div>
  );
};
