import React from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Printer, X } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { VoucherLogo } from './VoucherLogo';
import { paymentMethodLabel } from '../../constants/paymentMethods';

const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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

  let remainder = Math.floor(num);
  const g = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  let wordResult = '';
  let groupIndex = 0;
  while (remainder > 0) {
    const group = remainder % 1000;
    if (group > 0) {
      const groupWords = makeGroup(group);
      wordResult = groupWords + (g[groupIndex] ? ' ' + g[groupIndex] : '') + ' ' + wordResult;
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex++;
  }
  return wordResult.trim() || 'Zero';
};

const VOUCHER_THEMES = {
  DEBIT: {
    key: 'DEBIT',
    badge: 'DEBIT PAYMENT VOUCHER',
    topGradient: 'from-[#881337] via-[#E11D48] to-[#881337]',
    accentColor: '#E11D48',
    borderColor: '#FB7185',
    headerBg: 'bg-[#881337]',
    badgeClass: 'bg-[#881337] text-white',
    amountBg: 'from-[#4C0519] to-[#881337]',
    tagline: 'OFFICIAL EXPENSE OUTFLOW RECORD',
    tableHeaderBg: 'bg-[#881337]',
    defaultPartyLabel: 'Paid To (Recipient)'
  },
  CREDIT: {
    key: 'CREDIT',
    badge: 'CREDIT RECEIPT VOUCHER',
    topGradient: 'from-[#065F46] via-[#10B981] to-[#065F46]',
    accentColor: '#10B981',
    borderColor: '#34D399',
    headerBg: 'bg-[#065F46]',
    badgeClass: 'bg-[#065F46] text-white',
    amountBg: 'from-[#064E3B] to-[#065F46]',
    tagline: 'OFFICIAL FINANCIAL INFLOW RECEIPT',
    tableHeaderBg: 'bg-[#065F46]',
    defaultPartyLabel: 'Received From (Donor / Payee)'
  },
  ZAKAT: {
    key: 'ZAKAT',
    badge: 'ZAKAT & WELFARE AID VOUCHER',
    topGradient: 'from-[#3B1D0D] via-[#C88A58] to-[#3B1D0D]',
    accentColor: '#C88A58',
    borderColor: '#D49B6A',
    headerBg: 'bg-[#3B1D0D]',
    badgeClass: 'bg-[#3B1D0D] text-white',
    amountBg: 'from-[#3B1D0D] to-[#5C2E15]',
    tagline: 'CHARITABLE WELFARE OUTFLOW RECORD',
    tableHeaderBg: 'bg-[#3B1D0D]',
    defaultPartyLabel: 'Beneficiary / Recipient Name'
  },
  BANK: {
    key: 'BANK',
    badge: 'BANK TRANSACTION VOUCHER',
    topGradient: 'from-[#0B192C] via-[#0284C7] to-[#0B192C]',
    accentColor: '#0284C7',
    borderColor: '#38BDF8',
    headerBg: 'bg-[#0B192C]',
    badgeClass: 'bg-[#0B192C] text-white',
    amountBg: 'from-[#0B192C] to-[#1E293B]',
    tagline: 'OFFICIAL BANKING TRANSACTION SLIP',
    tableHeaderBg: 'bg-[#0B192C]',
    defaultPartyLabel: 'Bank Account / Payee'
  },
  TRANSFER: {
    key: 'TRANSFER',
    badge: 'JOURNAL & TRANSFER VOUCHER',
    topGradient: 'from-[#3B0764] via-[#A855F7] to-[#3B0764]',
    accentColor: '#A855F7',
    borderColor: '#C084FC',
    headerBg: 'bg-[#3B0764]',
    badgeClass: 'bg-[#3B0764] text-white',
    amountBg: 'from-[#3B0764] to-[#581C87]',
    tagline: 'INTERNAL LEDGER ACCOUNT TRANSFER',
    tableHeaderBg: 'bg-[#3B0764]',
    defaultPartyLabel: 'Transfer Source / Target Account'
  }
};

const resolveVoucherTheme = (title, typeProp) => {
  const t = (title || typeProp || '').toUpperCase();
  if (t.includes('ZAKAT') || t.includes('BENEFICIARY') || t.includes('AID')) return VOUCHER_THEMES.ZAKAT;
  if (t.includes('EXPENSE') || t.includes('DEBIT') || t.includes('PAYMENT OUT')) return VOUCHER_THEMES.DEBIT;
  if (t.includes('INCOME') || t.includes('RECEIPT') || t.includes('REVENUE') || t.includes('COLLECTION') || t.includes('CREDIT')) return VOUCHER_THEMES.CREDIT;
  if (t.includes('BANK') || t.includes('CHEQUE') || t.includes('DEPOSIT')) return VOUCHER_THEMES.BANK;
  if (t.includes('TRANSFER') || t.includes('JOURNAL') || t.includes('GL')) return VOUCHER_THEMES.TRANSFER;
  return VOUCHER_THEMES.DEBIT;
};

function CopySheet({
  copyLabel,
  title,
  voucherNo,
  fileNo,
  formattedDate,
  paidTo,
  fatherName,
  cnic,
  mobile,
  address,
  gham,
  paymentMethod,
  bankName,
  chequeNumber,
  amount,
  words,
  remarks,
  ledgerRows,
  preparedBy,
  verifiedBy,
  authorizedSign,
  payeeLabel,
  partyLabel
}) {
  const isOffice = copyLabel.toLowerCase().includes('office');
  const theme = resolveVoucherTheme(title);
  const displayPartyLabel = partyLabel || theme.defaultPartyLabel;

  return (
    <div
      className="voucher-copy-sheet relative flex flex-col justify-between rounded-2xl border-2 bg-[#FFFFFF] p-3.5 sm:p-4 shadow-xl print:rounded-none print:shadow-none print:border-slate-800 print:p-3 overflow-hidden text-slate-800"
      style={{ borderColor: theme.borderColor }}
    >
      {/* Dynamic Top Theme Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${theme.topGradient}`} />

      <div>
        {/* ── HEADER SECTION ── */}
        <div className="flex items-center justify-between border-b-2 pb-3 pt-1" style={{ borderColor: `${theme.accentColor}40` }}>
          {/* Logo & Jamaat Header */}
          <div className="flex items-center gap-3.5">
            <VoucherLogo className="h-16 w-16 sm:h-18 sm:w-18" />
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-[#0F172A] leading-tight">
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAT
              </div>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mt-1" style={{ color: theme.accentColor }}>
                KARACHI &bull; PAKISTAN &bull; {theme.tagline}
              </div>
            </div>
          </div>

          {/* Copy Badge & Voucher Type Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`px-3 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-[0.18em] text-white shadow-sm ${isOffice ? 'bg-[#0F172A]' : 'bg-[#065F46]'}`}>
              {copyLabel}
            </span>
            <span
              className="px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-[0.15em] shadow-inner"
              style={{ borderColor: theme.borderColor, color: '#0F172A', backgroundColor: '#F8FAFC' }}
            >
              {title || theme.badge}
            </span>
          </div>
        </div>

        {/* ── VOUCHER META & PARTY DETAILS GRID ── */}
        <div className="my-2.5 space-y-2">
          {/* Row 1: Key Financial Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-300">
            <div className="border-r border-slate-300 pr-2">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Voucher No</div>
              <div className="text-xs font-black text-slate-950 font-mono mt-0.5">{voucherNo || '—'}</div>
            </div>
            <div className="border-r border-slate-300 pr-2 pl-1">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Date</div>
              <div className="text-xs font-black text-slate-950 mt-0.5">{formattedDate}</div>
            </div>
            <div className="border-r border-slate-300 pr-2 pl-1">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Payment Mode</div>
              <div className="text-xs font-black mt-0.5" style={{ color: theme.accentColor }}>{paymentMethod}</div>
            </div>
            <div className="pl-1">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Ref / Category</div>
              <div className="text-xs font-black text-slate-950 break-words mt-0.5">{fileNo || '—'}</div>
            </div>
          </div>

          {/* Row 2: Comprehensive Person Info (Split into 2 rows of 3 columns each so nothing gets truncated) */}
          <div className="bg-[#F1F5F9] p-2.5 rounded-xl border border-slate-300 space-y-2">
            {/* Part 1: Name, Father/Husband Name, CNIC */}
            <div className="grid grid-cols-3 gap-2 border-b border-slate-300 pb-2">
              <div className="border-r border-slate-300 pr-2">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">{displayPartyLabel}</div>
                <div className="text-xs font-black text-slate-950 break-words mt-0.5">{paidTo || '—'}</div>
              </div>
              <div className="border-r border-slate-300 pr-2 pl-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Father / Husband</div>
                <div className="text-xs font-black text-slate-950 break-words mt-0.5">{(fatherName && fatherName !== gham) ? fatherName : (fatherName && !gham ? fatherName : '—')}</div>
              </div>
              <div className="pl-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">CNIC Number</div>
                <div className="text-xs font-black font-mono text-slate-950 break-all mt-0.5">{cnic || '—'}</div>
              </div>
            </div>

            {/* Part 2: Phone/Mobile, Gham Details, Address */}
            <div className="grid grid-cols-3 gap-2">
              <div className="border-r border-slate-300 pr-2">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Phone / Mobile</div>
                <div className="text-xs font-black font-mono text-slate-950 break-all mt-0.5">{mobile || '—'}</div>
              </div>
              <div className="border-r border-slate-300 pr-2 pl-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Gham Details</div>
                <div className="text-xs font-black text-slate-950 break-words mt-0.5">{gham || '—'}</div>
              </div>
              <div className="pl-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Address / Location</div>
                <div className="text-xs font-extrabold text-slate-950 break-words mt-0.5">{address || '—'}</div>
              </div>
            </div>
          </div>

          {/* Row 3: Bank & Cheque Details (if applicable) */}
          {(bankName || chequeNumber) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F8FAFC] p-2 rounded-xl border border-slate-300">
              <div className="border-r border-slate-300 pr-2">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Bank Name</div>
                <div className="text-xs font-black text-slate-950 break-words mt-0.5">{bankName || '—'}</div>
              </div>
              <div className="pl-1">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-[#0F172A]">Cheque / Instrument No</div>
                <div className="text-xs font-black font-mono text-slate-950 break-all mt-0.5">{chequeNumber || '—'}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── EXPLICIT ITEM VOUCHER DECLARATION BANNER ── */}
        <div className="my-2 flex items-center gap-2 rounded-xl bg-slate-100 p-2 border border-slate-300 text-xs font-semibold text-slate-900 shadow-sm">
          <span className="shrink-0 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: theme.accentColor }}>
            VOUCHER ITEM
          </span>
          <span className="text-[11px] text-slate-950 font-black break-words">
            This is the official voucher for <u className="underline decoration-2 font-black" style={{ textDecorationColor: theme.accentColor }}>{ledgerRows[0]?.account || title}</u>.
          </span>
        </div>

        {/* ── LEDGER ACCOUNTING TABLE ── */}
        <div className="overflow-hidden rounded-xl border border-slate-300 shadow-sm mb-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${theme.tableHeaderBg} text-white text-[9.5px] font-black uppercase tracking-wider`}>
                <th className="py-2 px-3 border-r border-slate-700">Account Head & Particular Narration</th>
                <th className="py-2 px-3 text-right w-32">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {ledgerRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="py-2 px-3 border-r border-slate-200">
                    <div className="font-black text-slate-950 break-words">{row.account}</div>
                    <div className="text-[10.5px] font-bold text-slate-800 mt-0.5 italic break-words">{row.narration}</div>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-slate-950 align-top">
                    Rs {Number(row.amount || 0).toLocaleString('en-PK')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F1F5F9] border-t-2 text-xs font-black text-slate-900" style={{ borderColor: theme.accentColor }}>
                <td className="py-1.5 px-3 uppercase tracking-wider text-[10px] text-[#0F172A] border-r border-slate-300">
                  Total Financial Outflow / Inflow
                </td>
                <td className="py-1.5 px-3 text-right text-slate-950 font-black">
                  Rs {Number(amount || 0).toLocaleString('en-PK')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── REMARKS & AMOUNT IN WORDS BANNER ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2.5">
          <div className="sm:col-span-7 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider" style={{ color: theme.accentColor }}>Amount in Words:</span>
              <div className="text-xs font-black italic text-slate-950 mt-0.5 break-words">
                "{words} Only"
              </div>
            </div>
            {remarks && (
              <div className="mt-1.5 pt-1 border-t border-slate-200 text-[10.5px] text-slate-800 break-words">
                <strong className="text-slate-950 font-black">Remarks:</strong> {remarks}
              </div>
            )}
          </div>

          <div
            className={`sm:col-span-5 bg-gradient-to-r ${theme.amountBg} p-2.5 rounded-xl border-2 text-white flex flex-col justify-center items-end text-right shadow-md`}
            style={{ borderColor: theme.borderColor }}
          >
            <span className="text-[8.5px] font-black uppercase tracking-[0.2em] opacity-90">Net Amount</span>
            <span className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
              Rs {Number(amount || 0).toLocaleString('en-PK')}/-
            </span>
          </div>
        </div>

        {/* ── THANK YOU APPRECIATION BANNER (ONLY FOR DONATION RECEIVED VOUCHERS) ── */}
        {/DONATION/i.test(title) && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300 text-center shadow-xs">
            <p className="text-[9.5px] sm:text-[10px] font-black text-slate-900 italic leading-snug">
              "Thank you for your generous donation to support the deserving members of Jamat. We sincerely appreciate your kindness and support."
            </p>
          </div>
        )}
      </div>

      {/* ── AUTHORIZATIONS & SIGNATURE STAMPS ── */}
      <div>
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200">
          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6 flex items-end justify-center pb-1">
              <span className="text-[10.5px] font-black text-slate-950">{preparedBy || 'System Admin'}</span>
            </div>
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-800">
              Prepared By
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-800">
              Checked By
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-800">
              Authorized Sign
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-800 truncate">
              {payeeLabel || 'Receiver Signature'}
            </div>
          </div>
        </div>

        {/* Bottom Official Footer Bar */}
        <div className="mt-2 flex items-center justify-between text-[8.5px] font-black uppercase tracking-wider text-slate-700 pt-1 border-t border-slate-200">
          <span>Ref: {fileNo || 'KMLWJ-VOUCHER'}</span>
          <span>Official Financial Document • Commercial Print Ready</span>
        </div>
      </div>

    </div>
  );
}

export const VoucherSlipModal = ({
  isOpen = true,
  onClose,
  title = 'DEBIT VOUCHER',
  voucherNo = '',
  fileNo = '',
  date = '',
  name = '',
  fatherName = '',
  cnic = '',
  mobile = '',
  phone = '',
  gham = '',
  address = '',
  bankName = '',
  chequeNumber = '',
  paymentMethod: paymentMethodProp,
  debitCredit = '',
  accountName = '',
  particulars = '',
  remarks: remarksProp = '',
  ledgerRows: ledgerRowsProp,
  amount = 0,
  preparedBy = 'System Admin',
  payeeLabel = "Payee Signature",
  partyLabel,
}) => {
  if (!isOpen) return null;

  const contactMobile = mobile || phone || '';

  const handlePrint = () => {
    window.print();
  };

  const isCollectionOrReceipt = /RECEIPT|COLLECTION|INCOME|REVENUE|MEMBERSHIP|FEE|DONATION RECEIVED/i.test(title);
  const computedPartyLabel = partyLabel || (isCollectionOrReceipt ? 'Paid By / Donor' : 'Paid To / Recipient');

  const formattedDate = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const words = numberToWords(amount || 0);
  const paymentMethod = paymentMethodLabel(paymentMethodProp ?? debitCredit);
  const ledgerRows = (ledgerRowsProp && ledgerRowsProp.length > 0)
    ? ledgerRowsProp
    : [
        {
          account: accountName || 'Primary Ledger Account',
          narration: particulars || 'Financial entry particulars',
          amount: amount || 0
        }
      ];

  const modalContent = (
    <div id="print-slip-portal-root" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm print:static print:p-0 print:bg-white print:block">
      <div className="absolute inset-0 print-hide-elem" onClick={onClose} />

      <div className="relative z-10 flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-slate-700 bg-[#0F172A] shadow-2xl print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block">
        
        {/* Modal Top Bar */}
        <div className="print-hide-elem flex items-center justify-between border-b border-slate-800 bg-[#0B132B] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-5 w-5 text-[#C5A059]" />
            <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-100">
              {title} PREVIEW
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#9A7B38] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white shadow-md transition hover:brightness-110"
            >
              <Printer className="h-4 w-4" /> Print Slip (A4)
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Container */}
        <div className="flex-1 overflow-y-auto bg-slate-200/90 p-3 sm:p-5 print:p-0 print:overflow-visible print:bg-white">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 0mm !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
                width: 100% !important;
                height: 100% !important;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
                box-shadow: none !important;
                text-shadow: none !important;
              }
              body > *:not(#print-slip-portal-root) {
                display: none !important;
              }
              .print-hide-elem {
                display: none !important;
              }
              #print-slip-portal-root,
              #print-slip-portal-root * {
                box-shadow: none !important;
                outline: none !important;
                border: none !important;
              }
              #print-slip-portal-root {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
                z-index: 99999999 !important;
              }
              #print-voucher-sheet-container {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                border: none !important;
                box-shadow: none !important;
              }
              .voucher-copy-sheet {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                box-shadow: none !important;
                border: none !important;
              }
            }
          `}</style>

          <div id="print-voucher-sheet-container" className="mx-auto w-full max-w-[1800px] rounded-[24px] bg-slate-900 p-2 print:p-0 print:bg-white print:rounded-none print:shadow-none print:border-none">
            <div className="relative overflow-hidden rounded-[20px] bg-slate-900 p-2.5 print:p-0 print:bg-white print:border-none">
              <div className="relative z-10 grid gap-3 xl:grid-cols-2 print:grid-cols-2">
                <CopySheet
                  copyLabel="Office Copy"
                  title={title}
                  voucherNo={voucherNo}
                  fileNo={fileNo}
                  formattedDate={formattedDate}
                  paidTo={name}
                  fatherName={fatherName}
                  cnic={cnic}
                  mobile={contactMobile}
                  address={address}
                  gham={gham}
                  paymentMethod={paymentMethod}
                  bankName={bankName}
                  chequeNumber={chequeNumber}
                  amount={amount}
                  words={words}
                  remarks={remarksProp || particulars}
                  ledgerRows={ledgerRows}
                  preparedBy={preparedBy}
                  verifiedBy="Director"
                  authorizedSign="Authorized Sign"
                  payeeLabel={payeeLabel}
                  partyLabel={computedPartyLabel}
                />
                <CopySheet
                  copyLabel="Customer Copy"
                  title={title}
                  voucherNo={voucherNo}
                  fileNo={fileNo}
                  formattedDate={formattedDate}
                  paidTo={name}
                  fatherName={fatherName}
                  cnic={cnic}
                  mobile={contactMobile}
                  address={address}
                  gham={gham}
                  paymentMethod={paymentMethod}
                  bankName={bankName}
                  chequeNumber={chequeNumber}
                  amount={amount}
                  words={words}
                  remarks={remarksProp || particulars}
                  ledgerRows={ledgerRows}
                  preparedBy={preparedBy}
                  verifiedBy="Director"
                  authorizedSign="Authorized Sign"
                  payeeLabel={payeeLabel}
                  partyLabel={computedPartyLabel}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default VoucherSlipModal;
