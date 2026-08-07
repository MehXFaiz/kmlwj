import React from 'react';
import { Printer, X, FileText, CheckCircle2, ShieldCheck, Receipt, Landmark } from 'lucide-react';
import logoImg from '../../assets/logo.png';
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

function CopySheet({
  copyLabel,
  title,
  voucherNo,
  fileNo,
  formattedDate,
  paidTo,
  paymentMethod,
  amount,
  words,
  remarks,
  ledgerRows,
  preparedBy,
  verifiedBy,
  authorizedSign,
  payeeLabel,
  partyLabel = 'Paid To'
}) {
  const isOffice = copyLabel.toLowerCase().includes('office');

  return (
    <div className="voucher-copy-sheet relative flex flex-col justify-between rounded-2xl border-2 border-[#C5A059] bg-[#FFFFFF] p-3.5 sm:p-4 shadow-xl print:rounded-none print:shadow-none print:border-slate-800 print:p-3 overflow-hidden text-slate-800">

      {/* Top Metallic Gold & Navy Gradient Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0F172A] via-[#C5A059] to-[#0F172A]" />

      <div>
        {/* ── HEADER SECTION ── */}
        <div className="flex items-center justify-between border-b-2 border-[#C5A059]/40 pb-3 pt-1">
          {/* Logo & Jamaat Header */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-[#C5A059] bg-[#0F172A] shadow-lg p-1">
              <img src={logoImg} alt="Logo" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-[#0F172A] leading-tight">
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAT
              </div>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-[#C5A059] mt-1">
                KARACHI &bull; PAKISTAN
              </div>
            </div>
          </div>

          {/* Copy Badge & Voucher Type */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`px-3 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-[0.18em] text-white shadow-sm ${isOffice ? 'bg-[#0F172A]' : 'bg-[#065F46]'}`}>
              {copyLabel}
            </span>
            <span className="px-3 py-1 rounded-lg border border-[#C5A059] bg-[#F8FAFC] text-[10px] font-black uppercase tracking-[0.15em] text-[#1E293B] shadow-inner">
              {title}
            </span>
          </div>
        </div>

        {/* ── VOUCHER META GRID ── */}
        <div className="my-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200">
          <div className="border-r border-slate-200 pr-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Voucher No</div>
            <div className="text-xs font-black text-[#0F172A] font-mono mt-0.5">{voucherNo || '—'}</div>
          </div>
          <div className="border-r border-slate-200 pr-2 pl-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Date</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{formattedDate}</div>
          </div>
          <div className="border-r border-slate-200 pr-2 pl-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{partyLabel}</div>
            <div className="text-xs font-black text-[#0F172A] truncate mt-0.5">{paidTo || '—'}</div>
          </div>
          <div className="pl-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payment Mode</div>
            <div className="text-xs font-bold text-[#C5A059] mt-0.5">{paymentMethod}</div>
          </div>
        </div>

        {/* ── LEDGER ACCOUNTING TABLE ── */}
        <div className="overflow-hidden rounded-xl border border-slate-300 shadow-sm mb-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0F172A] text-white text-[9.5px] font-black uppercase tracking-wider">
                <th className="py-2 px-3 border-r border-slate-700">Account Head & Particular Narration</th>
                <th className="py-2 px-3 text-right w-32">Debit (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {ledgerRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="py-2 px-3 border-r border-slate-200">
                    <div className="font-bold text-slate-900">{row.account}</div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 italic">{row.narration}</div>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-slate-900 align-top">
                    Rs {Number(row.amount || 0).toLocaleString('en-PK')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F1F5F9] border-t-2 border-[#C5A059] text-xs font-black text-slate-900">
                <td className="py-1.5 px-3 uppercase tracking-wider text-[10px] text-[#0F172A] border-r border-slate-300">
                  Total Debited Outflow
                </td>
                <td className="py-1.5 px-3 text-right text-slate-900 font-extrabold">
                  Rs {Number(amount || 0).toLocaleString('en-PK')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── REMARKS & AMOUNT IN WORDS BANNER ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
          <div className="sm:col-span-7 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#C5A059]">Amount in Words:</span>
              <div className="text-xs font-bold italic text-slate-900 mt-0.5">
                "{words} Only"
              </div>
            </div>
            {remarks && (
              <div className="mt-1.5 pt-1 border-t border-slate-200 text-[10.5px] text-slate-600 truncate">
                <strong className="text-slate-800">Remarks:</strong> {remarks}
              </div>
            )}
          </div>

          <div className="sm:col-span-5 bg-gradient-to-r from-[#0F172A] to-[#1E293B] p-2.5 rounded-xl border-2 border-[#C5A059] text-white flex flex-col justify-center items-end text-right shadow-md">
            <span className="text-[8.5px] font-black uppercase tracking-[0.2em] text-[#C5A059]">Net Debit Amount</span>
            <span className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
              Rs {Number(amount || 0).toLocaleString('en-PK')}/-
            </span>
          </div>
        </div>
      </div>

      {/* ── AUTHORIZATIONS & SIGNATURE STAMPS ── */}
      <div>
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200">
          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6 flex items-end justify-center pb-1">
              <span className="text-[10.5px] font-bold text-slate-800">{preparedBy || 'System Admin'}</span>
            </div>
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-500">
              Prepared By
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-500">
              Checked By
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-500">
              Authorized Sign
            </div>
          </div>

          <div className="text-center bg-[#F8FAFC] p-1.5 rounded-lg border border-slate-200">
            <div className="h-6" />
            <div className="border-t border-slate-300 pt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-500 truncate">
              {payeeLabel || 'Receiver'}
            </div>
          </div>
        </div>

        {/* Bottom Official Footer Bar */}
        <div className="mt-2 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-slate-400 pt-1 border-t border-slate-100">
          <span>Ref: {fileNo || 'KMLWJ-FIN-VOUCHER'}</span>
          <span>Official Financial Receipt • Commercial Print Ready</span>
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
  address = '',
  paymentMethod: paymentMethodProp,
  debitCredit = '',
  accountName = '',
  particulars = '',
  amount = 0,
  preparedBy = 'System Admin',
  payeeLabel = "Payee's Signature",
  partyLabel,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCollectionOrReceipt = /RECEIPT|COLLECTION|INCOME|REVENUE|MEMBERSHIP|FEE|DONATION RECEIVED/i.test(title);
  const computedPartyLabel = partyLabel || (isCollectionOrReceipt ? 'Paid By' : 'Paid To');

  const formattedDate = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const words = numberToWords(amount || 0);
  const paymentMethod = paymentMethodLabel(paymentMethodProp ?? debitCredit);
  const ledgerRows = [
    {
      account: accountName || 'Donation Disbursement / Aid Account',
      narration: particulars || 'Financial assistance disbursement entry',
      amount: amount || 0
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 print:p-0 print:static print:inset-auto print:block backdrop-blur-sm">
      <div className="absolute inset-0 print:hidden" onClick={onClose} />

      <div className="relative z-10 flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-slate-700 bg-[#0F172A] shadow-2xl print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0B132B] px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-5 w-5 text-[#C5A059]" />
            <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-100">
              Executive Debit Voucher Preview
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
        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 sm:p-5 print:p-0 print:overflow-visible print:bg-white">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 3mm 4mm !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #print-voucher-slip, #print-voucher-slip * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              #print-voucher-slip img, #print-voucher-slip svg {
                filter: none !important;
              }
              #print-voucher-slip {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .voucher-copy-sheet {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                box-shadow: none !important;
              }
            }
          `}</style>

          <div id="print-voucher-slip" className="mx-auto w-full max-w-[1800px] rounded-[24px] bg-slate-900 p-2 print:p-0 print:rounded-none print:shadow-none print:border-none">
            <div className="relative overflow-hidden rounded-[20px] bg-slate-900 p-2.5 print:p-0 print:border-none">
              <div className="relative z-10 grid gap-3 xl:grid-cols-2 print:grid-cols-2">
                <CopySheet
                  copyLabel="Office Copy"
                  title={title}
                  voucherNo={voucherNo}
                  fileNo={fileNo}
                  formattedDate={formattedDate}
                  paidTo={name}
                  paymentMethod={paymentMethod}
                  amount={amount}
                  words={words}
                  remarks={particulars}
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
                  paymentMethod={paymentMethod}
                  amount={amount}
                  words={words}
                  remarks={particulars}
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
};

export default VoucherSlipModal;
