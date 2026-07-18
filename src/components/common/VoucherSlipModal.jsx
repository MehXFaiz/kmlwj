import React from 'react';
import { Printer, X } from 'lucide-react';
import logoImg from '../../assets/logo.png';

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

export const VoucherSlipModal = ({
  isOpen = true,
  onClose,
  title = 'ZAKAT VOUCHER',
  voucherNo = '',
  fileNo = '',
  date = '',
  name = '',
  address = '',
  debitCredit = '',
  accountName = '',
  particulars = '',
  amount = 0,
  preparedBy = 'Operator',
  payeeLabel = "Payee's Signature"
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const amountRs = Math.floor(amount || 0).toLocaleString();
  const words = numberToWords(amount || 0);

  // Generate 15 punch hole dots for the left margin
  const punchHoles = Array.from({ length: 16 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print:p-0 print:static print:inset-auto print:block">
      {/* Backdrop - Hidden when printing */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm print:hidden animate-fade-in" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:w-full print:static print:block">
        
        {/* Top Control Bar - Hidden when printing */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Official Voucher Slip Preview</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint} 
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-amber-900/30 cursor-pointer select-none"
            >
              <Printer className="h-3.5 w-3.5" /> Print Voucher
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Slip Area */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-900 print:p-0 print:overflow-visible print:bg-white">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-voucher-slip, #print-voucher-slip * {
                visibility: visible !important;
              }
              #print-voucher-slip {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
              }
            }
          `}</style>
          
          {/* Classic Official Voucher Slip Box */}
          <div 
            id="print-voucher-slip"
            style={{ 
              backgroundColor: '#ffffff', 
              color: '#0f172a',
              fontFamily: "'Times New Roman', Times, serif",
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
            className="relative rounded-xl border-2 border-slate-700 shadow-2xl overflow-hidden flex p-4 sm:p-6 print:border-slate-800 print:shadow-none print:rounded-none min-h-[480px]"
          >
            {/* Left Spiral Notebook Punch Holes Column */}
            <div className="flex flex-col justify-between items-center pr-3 sm:pr-4 border-r-2 border-slate-300 mr-4 sm:mr-6 select-none py-1">
              {punchHoles.map((_, idx) => (
                <div 
                  key={idx} 
                  style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 shadow-inner my-1" 
                />
              ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative z-10 flex flex-col justify-between">
              
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-slate-800 gap-4">
                <div className="flex items-start gap-4">
                  <img
                    src={logoImg}
                    alt="Logo"
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-left font-bold tracking-wider text-sm sm:text-base text-slate-900">
                    <div className="font-semibold text-slate-900" style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", fontSize: '1.15rem' }}>
                      کچھی مسلم لوہارواڈھا ویلفیئر جماعت
                    </div>
                    <div className="text-base sm:text-xl uppercase font-black tracking-wide border-b-2 border-slate-800 pb-0.5 inline-block">
                      {title}
                    </div>
                  </div>
                </div>

                {/* Clean Pill Title Banner */}
                <div 
                  style={{ 
                    backgroundColor: '#f8fafc', 
                    color: '#0f172a',
                    borderColor: '#334155'
                  }}
                  className="px-6 sm:px-8 py-1 sm:py-1.5 rounded-full font-extrabold text-base sm:text-xl tracking-[0.25em] uppercase border-2 shadow-sm mx-auto sm:mx-0 print:border-slate-800 print:bg-[#f8fafc]"
                >
                  VOUCHER
                </div>

                <div className="text-right font-bold text-xs sm:text-sm text-slate-800 self-end sm:self-center">
                  <span>Date : </span>
                  <span className="font-normal border-b border-slate-800 px-2 inline-block min-w-[100px] text-center">
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Top Details (Name, Address, Voucher No, File No) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-4 items-end">
                {/* Left lines: Name & Address */}
                <div className="sm:col-span-7 space-y-3 text-xs sm:text-sm font-semibold text-slate-800">
                  <div className="flex items-baseline">
                    <span className="w-16 shrink-0 font-bold">Name:</span>
                    <span className="flex-1 border-b border-dotted border-slate-600 px-2 font-black text-slate-900">
                      {name || '__________________________________________'}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-16 shrink-0 font-bold">Address:</span>
                    <span className="flex-1 border-b border-dotted border-slate-600 px-2 font-normal text-slate-800">
                      {address || '__________________________________________'}
                    </span>
                  </div>
                </div>

                {/* Right box: Voucher No & File No */}
                <div className="sm:col-span-5 border-2 border-slate-800 p-2.5 rounded bg-slate-50 text-xs sm:text-sm font-semibold space-y-1.5">
                  <div className="flex justify-between items-baseline border-b border-slate-300 pb-1">
                    <span className="text-slate-600">Voucher No. :</span>
                    <span className="font-mono font-black text-slate-900">{voucherNo || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5">
                    <span className="text-slate-600">File / Ref No. :</span>
                    <span className="font-mono font-bold text-slate-900">{fileNo || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Debit / Credit A/c Line */}
              <div className="flex items-baseline text-xs sm:text-sm font-semibold text-slate-800 pb-3">
                <span className="shrink-0 font-bold">Debit / Credit:</span>
                <span className="flex-1 border-b-2 border-slate-800 px-3 mx-2 font-black text-center text-slate-900">
                  {debitCredit ? `${debitCredit} ${accountName ? `— (${accountName})` : ''}` : accountName || 'Cash / Bank Account'}
                </span>
                <span className="shrink-0 font-bold">A/c</span>
              </div>

              {/* Main Particulars Table */}
              <div className="relative border-2 border-slate-800 my-2 bg-white/75 print:bg-transparent rounded overflow-hidden">
                {/* Fixed Watermark Inside Particulars Table */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0 opacity-[0.10] print:opacity-[0.12]">
                  <img src={logoImg} alt="KMLWJ Logo Watermark" className="w-72 h-72 sm:w-80 sm:h-80 object-contain" />
                </div>
                <table className="relative z-10 w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-800 bg-slate-100 font-bold text-slate-900">
                      <th className="py-2 px-3 text-left w-3/4 border-r-2 border-slate-800 uppercase tracking-wider">
                        PARTICULARS
                      </th>
                      <th colSpan={2} className="py-1 px-2 text-center uppercase tracking-wider">
                        <div className="border-b border-slate-800 pb-0.5">Amount</div>
                        <div className="grid grid-cols-4 pt-0.5 text-xs font-semibold">
                          <span className="col-span-3 border-r border-slate-800">Rs.</span>
                          <span className="col-span-1">P.</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Main line item */}
                    <tr className="border-b border-slate-300">
                      <td className="py-3 px-3 border-r-2 border-slate-800 font-semibold text-slate-900">
                        {particulars || 'Contribution / Disbursed Amount'}
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono text-sm w-[18%] border-r border-slate-800 text-slate-900">
                        {amountRs}
                      </td>
                      <td className="py-3 px-1 text-center font-mono font-bold w-[7%] text-slate-700">
                        00
                      </td>
                    </tr>

                    {/* Empty spacer rows for authentic physical voucher feel */}
                    <tr className="border-b border-slate-300 h-8">
                      <td className="border-r-2 border-slate-800"></td>
                      <td className="border-r border-slate-800"></td>
                      <td></td>
                    </tr>
                    <tr className="border-b border-slate-800 h-8">
                      <td className="border-r-2 border-slate-800"></td>
                      <td className="border-r border-slate-800"></td>
                      <td></td>
                    </tr>

                    {/* Bottom Total Row */}
                    <tr className="bg-slate-100 font-bold">
                      <td className="py-2.5 px-3 border-r-2 border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <span className="italic font-serif text-xs sm:text-sm font-normal text-slate-700">
                          Rupees in words : <span className="font-semibold underline capitalize text-slate-900">{words} Only</span>
                        </span>
                        <span className="tracking-widest uppercase font-black text-sm mt-1 sm:mt-0 self-end text-slate-900">TOTAL</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-sm border-r border-slate-800 text-slate-900">
                        {amountRs}
                      </td>
                      <td className="py-2.5 px-1 text-center font-mono font-bold text-slate-900">
                        00
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer Signatures Area */}
              <div className="grid grid-cols-3 gap-2 pt-8 mt-2 items-end text-center font-serif italic text-xs sm:text-sm text-slate-800">
                <div className="text-left">
                  <div className="border-t-2 border-slate-800 pt-1.5 inline-block min-w-[120px] sm:min-w-[140px] font-semibold">
                    Prepared by: <span className="not-italic font-bold text-slate-900">{preparedBy}</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="border-t-2 border-slate-800 pt-1.5 inline-block min-w-[100px] sm:min-w-[140px] font-semibold">
                    Passed by
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="flex items-end gap-3">
                    <div className="border-t-2 border-slate-800 pt-1.5 inline-block font-semibold">
                      {payeeLabel}
                    </div>
                    {/* Stamp / Signature Box */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-slate-800 bg-slate-50 shadow-inner flex items-center justify-center text-[8px] uppercase tracking-tighter text-slate-500 font-sans not-italic font-bold">
                      Stamp
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherSlipModal;
