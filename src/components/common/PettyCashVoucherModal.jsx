import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Receipt } from 'lucide-react';
import { VoucherLogo } from './VoucherLogo';

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

export const PettyCashVoucherModal = ({ isOpen, onClose, voucher }) => {
  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const amount = Number(voucher.amount || 0);
  const words = `${numberToWords(amount)} Rupees Only`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">Petty Cash Voucher</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/40 text-amber-300 font-mono">
              {voucher.voucherNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Slip Body */}
        <div className="bg-slate-950 border border-slate-800/80 p-6 sm:p-8 rounded-xl space-y-6 print:bg-white print:text-black print:p-0 print:border-none">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:border-gray-300">
            <div className="flex items-center gap-4">
              <VoucherLogo className="h-16 w-16" />
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-100 print:text-black uppercase">KUTCHI MEMON LAXMIBAI TRUST</h2>
                <p className="text-xs text-slate-400 print:text-gray-600 font-medium">Petty Cash Management & Fund Disbursement System</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 text-xs font-black uppercase tracking-wider rounded-md bg-amber-950/80 border border-amber-800/60 text-amber-300 print:border-black print:bg-gray-100 print:text-black">
                PETTY CASH VOUCHER
              </span>
              <p className="text-xs font-mono text-slate-400 mt-1 print:text-gray-600">Date: {voucher.date}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 border-r border-slate-800/80 pr-4 print:border-gray-200">
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Voucher No:</span>
                <span className="font-mono font-bold text-slate-200 print:text-black">{voucher.voucherNo}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Transaction Type:</span>
                <span className="font-bold text-amber-400 print:text-black">{voucher.transactionType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Paid To / Recipient:</span>
                <span className="font-bold text-slate-200 print:text-black">{voucher.paidTo || '-'}</span>
              </div>
            </div>

            <div className="space-y-2 pl-2">
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Account:</span>
                <span className="font-bold text-slate-200 print:text-black">{voucher.expenseCategory || 'Petty Cash Fund'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Reference No:</span>
                <span className="font-mono text-slate-200 print:text-black">{voucher.referenceNo || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/40 print:border-gray-100">
                <span className="text-slate-500 font-semibold print:text-gray-600">Prepared By:</span>
                <span className="font-bold text-slate-200 print:text-black">{voucher.createdBy || 'Authorized Custodian'}</span>
              </div>
            </div>
          </div>

          {/* Description & Amount */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3 print:border-gray-300 print:bg-gray-50">
            <div className="text-xs">
              <span className="text-slate-500 font-semibold print:text-gray-600">Description / Narration:</span>
              <p className="mt-1 font-medium text-slate-200 print:text-black">{voucher.narration || 'No description provided.'}</p>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t border-slate-800/80 print:border-gray-300">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 print:text-gray-600">Amount in Words</span>
                <p className="text-xs font-bold text-slate-300 italic print:text-black">{words}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-400 print:text-gray-600">Total Amount</span>
                <p className="text-xl font-black font-mono text-amber-400 print:text-black">
                  PKR {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-10 grid grid-cols-3 gap-4 text-center text-xs font-bold text-slate-400 print:text-gray-600">
            <div className="border-t border-slate-800 pt-2 print:border-gray-400">
              <p>Prepared By</p>
            </div>
            <div className="border-t border-slate-800 pt-2 print:border-gray-400">
              <p>Checked By</p>
            </div>
            <div className="border-t border-slate-800 pt-2 print:border-gray-400">
              <p>Authorized Signature</p>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};
