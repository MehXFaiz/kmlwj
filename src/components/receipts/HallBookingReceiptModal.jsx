import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Copy, Check, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoImg from '../../assets/logo.png';

const numberToWords = (num) => {
  if (!num) return '';
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if ((num = num.toString()).length > 9) return 'Overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Rupees Only';
};

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const SpaciousReceiptPage = ({ booking, copyType, copyUrduTitle, copyEnglishTitle, isLast }) => {
  const bookingDateStr = formatDateDDMMYYYY(booking.bookingDate || booking.createdAt);
  const programDateStr = formatDateDDMMYYYY(booking.programDate);

  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const programDayUrdu = booking.programDate ? daysUrdu[new Date(booking.programDate).getDay()] : '';

  const amountWords = numberToWords(booking.amount);

  const hallName = (booking.hallName || booking.hallAccount?.accountName || booking.hallAccount?.name || '').toLowerCase();
  const isBagh = hallName.includes('bagh') || hallName.includes('hajiani') || hallName.includes('hajiyani') || hallName.includes('باغ') || hallName.includes('گارڈن');
  const isSadaBahar = hallName.includes('sada') || hallName.includes('sadaya') || hallName.includes('سدا');
  const isZakaria = hallName.includes('zakaria') || hallName.includes('zikarya') || hallName.includes('zikriya') || hallName.includes('zakriya') || hallName.includes('zakariya') || hallName.includes('زکریا');
  const isGosha = hallName.includes('gosha') || hallName.includes('annexy') || hallName.includes('anexy') || hallName.includes('anxy') || hallName.includes('گوشہ') || hallName.includes('اینیکسی');

  const hallsList = [
    { id: 'bagh', urduName: 'باغ حاجیانی گارڈن', englishName: 'Bagh-e-Hajiani Garden', selected: isBagh },
    { id: 'sada', urduName: 'صدایا ہال', englishName: 'Sadaya Hall', selected: isSadaBahar },
    { id: 'zakaria', urduName: 'زکریا ہال', englishName: 'Zakaria Hall', selected: isZakaria },
    { id: 'gosha', urduName: 'اینیکسی ہال', englishName: 'Annexy Hall', selected: isGosha }
  ];

  const isCustomer = copyType === 'customer';

  return (
    <div
      className="w-full max-w-[780px] print:max-w-full bg-white border-0 print:border-none p-2 sm:p-3 print:py-1 print:px-2 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-none print:shadow-none box-border"
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Formal Treasury Double-Border Frame */}
      <div className="border-2 border-slate-800 print:border-slate-800 p-3 sm:p-4 print:py-1.5 print:px-3 relative bg-white">
        {/* Subtle Background Seal Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
          <img src={logoImg} alt="Watermark" className="w-[220px] h-[220px] object-contain" />
        </div>

        {/* Header Block: Formal Bank Draft Lockup */}
        <div className="relative z-10 border-b-2 border-slate-800 pb-2 mb-2 print:pb-1 print:mb-1.5 flex items-center justify-between gap-3">
          {/* Right Section: Crest & Organization Header */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center print:w-15 print:h-15">
              <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="text-right">
              <h1 className="text-lg sm:text-xl font-black text-[#0f5132] leading-normal print:text-lg print:leading-normal">
                کچھی مسلم لوھارواڑھا ویلفیئر جماعت
              </h1>
              <p className="text-xs font-bold text-slate-700 leading-relaxed print:text-[11px] print:leading-relaxed">
                جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی — <span className="font-sans font-bold text-slate-600">REG NO: 1319</span>
              </p>
            </div>
          </div>

          {/* Left Section: Sharp Official Ledger Badge Box */}
          <div className="shrink-0 border-2 border-slate-800 bg-slate-50 print:bg-white text-center font-sans">
            <div
              className="px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white print:px-2 print:py-0.5"
              style={{
                backgroundColor: isCustomer ? '#0f5132' : '#1e293b',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              {copyEnglishTitle}
            </div>
            <div className="px-3 py-1 print:py-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase block tracking-wider">VOUCHER NO</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 block leading-none">
                #{booking.receiptNo || '1'}
              </span>
            </div>
            <div className="border-t border-slate-800 px-2 py-0.5 bg-slate-100 print:bg-slate-100 text-[10px] sm:text-xs font-bold text-slate-800 font-urdu">
              {copyUrduTitle}
            </div>
          </div>
        </div>

        {/* Master Architectural Ledger Table */}
        <div className="relative z-10 border-2 border-slate-800 divide-y-2 divide-slate-800 text-slate-900 bg-white">
          {/* Row 1: Customer Name & Mobile/Booking Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800">
            <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2 bg-slate-50/40">
              <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs">نام بکنگ کنندہ (Booker Name):</span>
              <span className="text-sm sm:text-base font-black text-slate-900 print:text-sm">{booking.bookerName || '—'}</span>
            </div>
            <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2">
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs">رابطہ نمبر (Mobile No): </span>
                <span className="text-xs sm:text-sm font-sans font-black text-[#0f5132] print:text-xs" dir="ltr">{booking.mobile || '—'}</span>
              </div>
              <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 print:text-[10px]">Date: {bookingDateStr}</span>
            </div>
          </div>

          {/* Row 2: Address & Community Member Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800">
            <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2">
              <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs">پتہ (Address):</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-xs">{booking.address || '—'}</span>
            </div>
            <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2 bg-slate-50/40">
              <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs">بکنگ برائے جماعت (Jamaat Member):</span>
              <span className="text-xs font-black text-slate-900 print:text-xs">
                {booking.isForJamaat ? 'ہاں (Yes — Member)' : 'نہیں (No — General)'}
              </span>
            </div>
          </div>

          {/* Row 3: Event Date, Day, Type & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800 bg-slate-50/60 print:bg-slate-50">
            <div className="p-1.5 sm:p-2 print:py-1 print:px-2 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">EVENT DATE / تاریخِ تقریب</span>
                <span className="text-sm sm:text-base font-sans font-black text-[#0f5132] print:text-sm">{programDateStr}</span>
              </div>
              <span className="text-xs font-bold text-slate-700 print:text-xs">بروز: {programDayUrdu}</span>
            </div>

            <div className="p-1.5 sm:p-2 print:py-1 print:px-2 flex items-center justify-between">
              <span className="text-[9px] font-sans font-bold text-slate-500 uppercase print:text-[8px]">PROGRAM TYPE / نوعیت:</span>
              <span className="text-sm sm:text-base font-black text-slate-900 print:text-sm">{booking.programType || 'تقریب'}</span>
            </div>

            <div className="p-1.5 sm:p-2 print:py-1 print:px-2 flex items-center justify-between">
              <span className="text-[9px] font-sans font-bold text-slate-500 uppercase print:text-[8px]">SHIFT / اوقات:</span>
              <span className="text-sm sm:text-base font-sans font-black text-slate-900 print:text-sm">{booking.timings || 'Evening'}</span>
            </div>
          </div>

          {/* Row 4: Allocated Community Hall Horizontal Strip */}
          <div className="p-1.5 sm:p-2 print:p-1.5">
            <div className="flex items-center justify-between mb-1 print:mb-0.5">
              <span className="text-xs font-bold text-slate-700 print:text-[11px]">منتخب کردہ ہال (Allocated Community Hall):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-800 divide-x divide-x-reverse divide-slate-800">
              {hallsList.map((hall) => (
                <div
                  key={hall.id}
                  className="p-1 sm:p-1.5 text-center print:py-1 print:px-1"
                  style={
                    hall.selected
                      ? {
                          backgroundColor: '#0f5132',
                          color: '#ffffff',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact'
                        }
                      : {
                          backgroundColor: '#f8fafc',
                          color: '#64748b'
                        }
                  }
                >
                  <div className="flex items-center justify-center gap-1">
                    {hall.selected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                    <span className={`text-xs sm:text-sm font-bold print:text-xs ${hall.selected ? 'text-white' : 'text-slate-500'}`}>
                      {hall.urduName}
                    </span>
                  </div>
                  <span className={`text-[8px] sm:text-[9px] font-sans block print:text-[8px] ${hall.selected ? 'text-emerald-100 font-bold' : 'text-slate-400'}`}>
                    {hall.englishName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 5: Financial Treasury Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800">
            <div className="sm:col-span-2 p-1.5 sm:p-2 print:py-1 print:px-2.5 flex flex-col justify-center">
              <span className="text-[9px] font-sans font-bold text-slate-500 uppercase tracking-wider block print:text-[8px]">AMOUNT RECEIVED IN WORDS / مبلغ حرفی</span>
              <p className="text-xs sm:text-sm font-sans font-extrabold italic text-slate-900 mt-0.5 capitalize print:text-xs">
                {amountWords}
              </p>
            </div>

            <div
              className="p-2 sm:p-2.5 print:py-1.5 print:px-3 flex flex-col justify-center items-center text-center"
              style={{
                backgroundColor: '#1e293b',
                color: '#ffffff',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              <span className="text-[8px] font-sans uppercase tracking-widest font-bold text-slate-300 print:text-[7px]">TOTAL AMOUNT PAID</span>
              <div className="text-base sm:text-lg font-sans font-black text-white print:text-base mt-0.5">
                Rs. {Number(booking.amount || 0).toLocaleString()}/-
              </div>
            </div>
          </div>
        </div>

        {/* Formal Signature Lockup Row */}
        <div className="relative z-10 pt-2 sm:pt-2.5 pb-0.5 grid grid-cols-4 items-end gap-2 text-center mt-2 print:mt-1.5">
          <div className="flex flex-col items-center">
            <div className="w-18 sm:w-24 border-b border-slate-800 pb-0.5 mb-0.5 print:w-18"></div>
            <span className="text-xs font-bold text-slate-800 print:text-xs">وصول کنندہ</span>
            <span className="text-[7px] font-sans text-slate-500 font-bold uppercase tracking-wider print:text-[6px]">Received By</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-18 sm:w-24 border-b border-slate-800 pb-0.5 mb-0.5 print:w-18"></div>
            <span className="text-xs font-bold text-slate-800 print:text-xs">رعایت کی منظوری</span>
            <span className="text-[7px] font-sans text-slate-500 font-bold uppercase tracking-wider print:text-[6px]">Discount Approval</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-18 sm:w-24 border-b border-slate-800 pb-0.5 mb-0.5 print:w-18"></div>
            <span className="text-xs font-bold text-slate-800 print:text-xs">بکنگ کلرک</span>
            <span className="text-[7px] font-sans text-slate-500 font-bold uppercase tracking-wider print:text-[6px]">Booking Officer</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-18 sm:w-24 border-b border-slate-800 pb-0.5 mb-0.5 print:w-18"></div>
            <span className="text-xs font-bold text-slate-800 print:text-xs">جنرل سیکریٹری</span>
            <span className="text-[7px] font-sans text-slate-500 font-bold uppercase tracking-wider print:text-[6px]">General Secretary</span>
          </div>
        </div>

        {/* Footer Terms */}
        <div className="relative z-10 mt-1.5 pt-1 border-t border-slate-300 text-center print:mt-1 print:pt-0.5">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-600 print:text-[9px]">
            ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا اختیار ہوگا۔
          </p>
        </div>
      </div>
    </div>
  );
};

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  const { t } = useTranslation();
  const [printMode, setPrintMode] = useState('both'); // 'both' | 'customer' | 'office'

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!booking) return null;

  return createPortal(
    <div id="print-receipt-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md print:p-0 print:bg-white print:backdrop-blur-none overflow-y-auto print:overflow-visible print:static print:inset-auto print:block">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden print:overflow-visible border border-slate-200 print:border-none print:static print:block print:w-full">
        
        {/* Actions & Copy Mode Selector Bar (Hidden in Print) */}
        <div className="print-hide-bar flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Official Hall Booking Certificate</h2>
              <p className="text-xs text-slate-400">Spacious Full-Page Executive Voucher Layout</p>
            </div>
          </div>

          {/* Copy Selector Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPrintMode('both')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Copy className="h-3 w-3 inline mr-1.5" />
              Both Copies (2 Pages)
            </button>
            <button
              onClick={() => setPrintMode('customer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Customer Copy Only (1 Page)
            </button>
            <button
              onClick={() => setPrintMode('office')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'office'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Office Copy Only (1 Page)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Receipt Container */}
        <div className="overflow-y-auto print:overflow-visible bg-slate-100/60 print:bg-white flex flex-col items-center p-4 sm:p-8 print:p-0 print:static print:block">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-hide-bar,
              .print-hide-bar * {
                display: none !important;
              }
              #print-receipt-modal,
              #print-receipt-modal * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #print-receipt-modal {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 100% !important;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                z-index: 999999 !important;
                display: block !important;
              }
              #print-receipt-wrapper {
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
              }
              .receipt-page-break {
                page-break-after: always !important;
                break-after: page !important;
              }
              @page {
                size: A4 portrait;
                margin: 4mm;
              }
            }
          `}</style>

          <div id="print-receipt-wrapper" className="w-full max-w-[780px] print:max-w-full flex flex-col items-center">
            {/* Customer Copy */}
            {(printMode === 'both' || printMode === 'customer') && (
              <SpaciousReceiptPage
                key="customer-copy"
                booking={booking}
                copyType="customer"
                copyUrduTitle="صارف کاپی (Customer Copy)"
                copyEnglishTitle="CUSTOMER COPY"
                isLast={printMode === 'customer'}
              />
            )}

            {/* Scissor Cut Line Separator */}
            {printMode === 'both' && (
              <div className="w-full my-2 print:my-1 flex items-center gap-2 text-slate-500 select-none">
                <div className="flex-1 border-b-2 border-dashed border-slate-400"></div>
                <span className="text-lg print:text-sm text-slate-600 font-bold">✂</span>
                <div className="flex-1 border-b-2 border-dashed border-slate-400"></div>
              </div>
            )}

            {/* Office Copy */}
            {(printMode === 'both' || printMode === 'office') && (
              <SpaciousReceiptPage
                key="office-copy"
                booking={booking}
                copyType="office"
                copyUrduTitle="دفتری ریکارڈ کاپی (Office Record Copy)"
                copyEnglishTitle="OFFICE RECORD COPY"
                isLast={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

