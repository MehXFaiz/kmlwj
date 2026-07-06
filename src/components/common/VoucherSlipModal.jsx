import React from 'react';
import { Printer, X } from 'lucide-react';

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
          
          {/* Classic Vintage Slip Box */}
          <div 
            id="print-voucher-slip"
            style={{ 
              backgroundColor: '#f5f0e1', 
              color: '#1a1816',
              fontFamily: "'Times New Roman', Times, serif",
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
            className="relative rounded-lg border-2 border-[#8c8270] shadow-2xl overflow-hidden flex p-4 sm:p-6 print:border-[#4a4238] print:shadow-none print:rounded-none min-h-[480px]"
          >
            {/* Left Spiral Notebook Punch Holes Column */}
            <div className="flex flex-col justify-between items-center pr-3 sm:pr-4 border-r border-[#c2baa8] mr-4 sm:mr-6 select-none py-1">
              {punchHoles.map((_, idx) => (
                <div 
                  key={idx} 
                  style={{ backgroundColor: '#d1c7b3', borderColor: '#a39b8b' }}
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border shadow-inner my-1" 
                />
              ))}
            </div>

            {/* Background Emblem/Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0 opacity-[0.06]">
              <div className="text-center font-bold tracking-tighter" style={{ fontSize: '180px', lineHeight: '0.8', color: '#4a4238' }}>
                KMLWJ
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative z-1 flex flex-col justify-between">
              
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#a89f8d] gap-4">
                <div className="text-left font-bold tracking-wider text-sm sm:text-base text-[#2d2925]">
                  <div className="uppercase tracking-widest text-xs sm:text-sm font-semibold text-[#5c5346]">LOHARWADA</div>
                  <div className="text-base sm:text-xl uppercase font-black tracking-wide border-b-2 border-[#2d2925] pb-0.5 inline-block">
                    {title}
                  </div>
                </div>

                {/* Dark Pill Title Banner */}
                <div 
                  style={{ backgroundColor: '#2b2623', color: '#f5f0e1' }}
                  className="px-6 sm:px-8 py-1 sm:py-1.5 rounded-full font-bold text-base sm:text-xl tracking-[0.2em] uppercase shadow-md mx-auto sm:mx-0"
                >
                  VOUCHER
                </div>

                <div className="text-right font-bold text-xs sm:text-sm text-[#2d2925] self-end sm:self-center">
                  <span>Date : </span>
                  <span className="font-normal border-b border-[#2d2925] px-2 inline-block min-w-[100px] text-center">
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Top Details (Name, Address, Voucher No, File No) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 py-4 items-end">
                {/* Left lines: Name & Address */}
                <div className="sm:col-span-7 space-y-3 text-xs sm:text-sm font-semibold text-[#2d2925]">
                  <div className="flex items-baseline">
                    <span className="w-16 shrink-0">Name</span>
                    <span className="flex-1 border-b border-dotted border-[#4a4238] px-2 font-bold text-[#1a1816]">
                      {name || '__________________________________________'}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-16 shrink-0">Address</span>
                    <span className="flex-1 border-b border-dotted border-[#4a4238] px-2 font-normal">
                      {address || '__________________________________________'}
                    </span>
                  </div>
                </div>

                {/* Right box: Voucher No & File No */}
                <div className="sm:col-span-5 border-2 border-[#4a4238] p-2 sm:p-2.5 rounded bg-[#efe9d8]/60 text-xs sm:text-sm font-semibold space-y-1.5">
                  <div className="flex justify-between items-baseline border-b border-[#c2baa8] pb-1">
                    <span>Voucher No. :</span>
                    <span className="font-mono font-bold text-[#1a1816]">{voucherNo || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5">
                    <span>File / Ref No. :</span>
                    <span className="font-mono font-bold text-[#1a1816]">{fileNo || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Debit / Credit A/c Line */}
              <div className="flex items-baseline text-xs sm:text-sm font-semibold text-[#2d2925] pb-3">
                <span className="shrink-0">Debit / Credit</span>
                <span className="flex-1 border-b border-[#4a4238] px-3 mx-2 font-bold text-center">
                  {debitCredit ? `${debitCredit} ${accountName ? `— (${accountName})` : ''}` : accountName || 'Cash / Bank Account'}
                </span>
                <span className="shrink-0 font-bold">A/c</span>
              </div>

              {/* Main Particulars Table */}
              <div className="border-2 border-[#4a4238] my-2 bg-[#efe9d8]/30">
                <table className="w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#4a4238] bg-[#e8e1cd]/80 font-bold text-[#2d2925]">
                      <th className="py-2 px-3 text-left w-3/4 border-r-2 border-[#4a4238] uppercase tracking-wider">
                        PARTICULARS
                      </th>
                      <th colSpan={2} className="py-1 px-2 text-center uppercase tracking-wider">
                        <div className="border-b border-[#4a4238] pb-0.5">Amount</div>
                        <div className="grid grid-cols-4 pt-0.5 text-xs">
                          <span className="col-span-3 border-r border-[#4a4238]">Rs.</span>
                          <span className="col-span-1">P.</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Main line item */}
                    <tr className="border-b border-[#a89f8d]">
                      <td className="py-2.5 px-3 border-r-2 border-[#4a4238] font-semibold text-[#1a1816]">
                        {particulars || 'Contribution / Disbursed Amount'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono w-[18%] border-r border-[#a89f8d]">
                        {amountRs}
                      </td>
                      <td className="py-2.5 px-1 text-center font-mono w-[7%]">
                        00
                      </td>
                    </tr>

                    {/* Empty spacer rows for authentic physical voucher feel */}
                    <tr className="border-b border-[#a89f8d] h-7">
                      <td className="border-r-2 border-[#4a4238]"></td>
                      <td className="border-r border-[#a89f8d]"></td>
                      <td></td>
                    </tr>
                    <tr className="border-b border-[#4a4238] h-7">
                      <td className="border-r-2 border-[#4a4238]"></td>
                      <td className="border-r border-[#a89f8d]"></td>
                      <td></td>
                    </tr>

                    {/* Bottom Total Row */}
                    <tr className="bg-[#e8e1cd]/50 font-bold">
                      <td className="py-2 px-3 border-r-2 border-[#4a4238] flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <span className="italic font-serif text-xs sm:text-sm font-normal text-[#3b352e]">
                          Rupees in words : <span className="font-semibold underline capitalize">{words} Only</span>
                        </span>
                        <span className="tracking-widest uppercase font-black text-sm mt-1 sm:mt-0 self-end">TOTAL</span>
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono text-sm border-r border-[#a89f8d] text-[#1a1816]">
                        {amountRs}
                      </td>
                      <td className="py-2 px-1 text-center font-mono font-bold">
                        00
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer Signatures Area */}
              <div className="grid grid-cols-3 gap-2 pt-8 mt-2 items-end text-center font-serif italic text-xs sm:text-sm text-[#2d2925]">
                <div className="text-left">
                  <div className="border-t border-[#4a4238] pt-1 inline-block min-w-[120px] sm:min-w-[140px]">
                    Prepared by : <span className="font-semibold not-italic">{preparedBy}</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="border-t border-[#4a4238] pt-1 inline-block min-w-[100px] sm:min-w-[140px]">
                    Passed by
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="flex items-end gap-2">
                    <div className="border-t border-[#4a4238] pt-1 inline-block">
                      {payeeLabel}
                    </div>
                    {/* Stamp / Signature Box */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-[#4a4238] bg-white/40 shadow-inner flex items-center justify-center text-[8px] uppercase tracking-tighter text-[#8c8270] font-sans not-italic">
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
