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
      className="w-full max-w-[780px] print:max-w-full bg-white border-0 print:border-none p-3 sm:p-4 print:py-1.5 print:px-2 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-none print:shadow-none box-border"
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Official Top Decorative Gold & Emerald Accent Strip */}
      <div
        className="w-full h-1.5 rounded-t-full mb-2 print:mb-1.5"
        style={{
          background: 'linear-gradient(90deg, #0d5c3a 0%, #10b981 50%, #0d5c3a 100%)',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      />

      {/* Subtle Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
        <img src={logoImg} alt="Watermark" className="w-[240px] h-[240px] object-contain" />
      </div>

      {/* Header Block - Executive Lockup */}
      <div className="relative z-10 border-b-2 border-[#0d5c3a] pb-2 sm:pb-2.5 mb-2 print:pb-1 print:mb-1.5">
        <div className="flex items-center justify-between gap-3">
          {/* Right Emblem - Official Seal Size */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center print:w-18 print:h-18">
            <img src={logoImg} alt="Logo" className="w-15 h-15 sm:w-19 sm:h-19 print:w-17 print:h-17 object-contain drop-shadow-xs" />
          </div>

          {/* Center Official Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#0d5c3a] leading-normal print:text-lg print:leading-normal tracking-tight">
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 leading-relaxed print:text-[11px] print:leading-relaxed">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
            </p>
            <div className="inline-flex items-center justify-center gap-2 mt-0.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-300/60 rounded-full print:py-0">
              <span className="text-[10px] sm:text-xs font-sans font-bold text-[#0d5c3a]">
                REG NO: 1319
              </span>
            </div>
          </div>

          {/* Left Official Voucher Badge & Copy Type */}
          <div className="shrink-0 flex flex-col items-end text-left font-sans">
            <div
              className="px-3 py-0.5 rounded-md text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-white mb-1 print:mb-0.5 print:px-2.5 print:py-0.5 print:text-[9px] shadow-xs"
              style={{
                backgroundColor: isCustomer ? '#0d5c3a' : '#1e3a8a',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              {copyEnglishTitle}
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-wider print:text-[8px]">RECEIPT NO</span>
              <span className="text-lg sm:text-xl font-black text-[#0d5c3a] block leading-none print:text-lg">
                #{booking.receiptNo || '1'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-700 font-urdu block leading-relaxed print:text-xs">
                {copyUrduTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="relative z-10 space-y-2 print:space-y-1.5">
        {/* Customer & Booking Details - Official Section */}
        <div className="border border-[#0d5c3a]/30 rounded-lg overflow-hidden print:rounded-md shadow-2xs print:shadow-none">
          <div
            className="px-3 py-1 sm:px-4 sm:py-1 flex items-center justify-between text-xs font-bold border-b border-[#0d5c3a]/20 print:px-2.5 print:py-0.5"
            style={{
              backgroundColor: '#0d5c3a',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-xs sm:text-sm font-bold text-white print:text-xs leading-relaxed">معلوماتِ بکنگ کنندہ (Customer &amp; Booking Information)</span>
            <span className="font-sans font-bold text-emerald-100 text-[11px] print:text-[10px]">Booking Date: {bookingDateStr}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800 bg-white">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2.5">
                <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs leading-relaxed">نام بکنگ کنندہ (Booker Name):</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 print:text-sm leading-relaxed">{booking.bookerName || '—'}</span>
              </div>
              <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2.5">
                <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs leading-relaxed">رابطہ نمبر (Mobile No):</span>
                <span className="text-xs sm:text-sm font-sans font-extrabold text-[#0d5c3a] print:text-xs" dir="ltr">{booking.mobile || '—'}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2.5">
                <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs leading-relaxed">بکنگ برائے جماعت (Jamaat Member):</span>
                <span
                  className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded border print:text-[10px] print:px-2 leading-relaxed"
                  style={{
                    backgroundColor: booking.isForJamaat ? '#ecfdf5' : '#f8fafc',
                    color: booking.isForJamaat ? '#065f46' : '#475569',
                    borderColor: booking.isForJamaat ? '#6ee7b7' : '#cbd5e1',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact'
                  }}
                >
                  {booking.isForJamaat ? 'ہاں (Yes - Community Member)' : 'نہیں (No - General)'}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 flex items-center justify-between print:py-1 print:px-2.5">
                <span className="text-xs sm:text-sm font-bold text-slate-600 print:text-xs leading-relaxed">پتہ (Address):</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 text-left print:text-xs leading-relaxed">{booking.address || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Schedule & Venue - Official Section */}
        <div className="border border-[#0d5c3a]/30 rounded-lg overflow-hidden print:rounded-md shadow-2xs print:shadow-none">
          <div
            className="px-3 py-1 sm:px-4 sm:py-1 flex items-center justify-between text-xs font-bold border-b border-[#0d5c3a]/20 print:px-2.5 print:py-0.5"
            style={{
              backgroundColor: '#0d5c3a',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-xs sm:text-sm font-bold text-white print:text-xs leading-relaxed">تفصیلاتِ تقریب و ہال (Event Schedule &amp; Venue Details)</span>
            <span className="font-bold text-emerald-100 text-[11px] print:text-[10px]">بروز: {programDayUrdu}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800 bg-white">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2 print:py-1 print:px-2.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Program Date / تاریخِ تقریب</span>
                <span className="text-sm sm:text-base font-sans font-black text-[#0d5c3a] block print:text-sm mt-0.5">{programDateStr}</span>
                <span className="text-[11px] text-slate-600 font-bold block print:text-[10px] leading-relaxed">بروز: {programDayUrdu}</span>
              </div>

              <div className="p-1.5 sm:p-2 print:py-1 print:px-2.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Event Type / پروگرام کی نوعیت</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 block print:text-sm mt-0.5 leading-relaxed">{booking.programType || 'تقریب'}</span>
              </div>

              <div className="p-1.5 sm:p-2 print:py-1 print:px-2.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Event Timings / اوقات</span>
                <span className="text-sm sm:text-base font-sans font-bold text-slate-900 block print:text-sm mt-0.5">{booking.timings || 'Evening'}</span>
              </div>
            </div>

            {/* Row 2: Selected Hall Stamped Cards */}
            <div className="p-1.5 sm:p-2 bg-slate-50/70 print:p-1.5">
              <span className="text-[11px] font-sans font-bold text-slate-600 uppercase block mb-1 print:text-[10px] print:mb-1 leading-relaxed">Selected Community Hall / منتخب کردہ ہال:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {hallsList.map((hall) => (
                  <div
                    key={hall.id}
                    className={`p-1 sm:p-1.5 rounded-lg border text-center transition-all print:py-0.5 print:px-1 ${
                      hall.selected
                        ? 'border-[#0d5c3a] shadow-xs'
                        : 'border-slate-200 bg-white opacity-40'
                    }`}
                    style={
                      hall.selected
                        ? {
                            backgroundColor: '#0d5c3a',
                            color: '#ffffff',
                            borderColor: '#0d5c3a',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact'
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      {hall.selected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                      <span className={`text-xs sm:text-sm font-bold print:text-xs leading-relaxed ${hall.selected ? 'text-white' : 'text-slate-600'}`}>
                        {hall.urduName}
                      </span>
                    </div>
                    <span className={`text-[8px] sm:text-[9px] font-sans block print:text-[8px] ${hall.selected ? 'text-emerald-100 font-medium' : 'text-slate-400'}`}>
                      {hall.englishName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Treasury Financial Banner */}
        <div
          className="border border-[#0d5c3a]/40 rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-2 print:py-1.5 print:px-3 print:rounded-md shadow-xs print:shadow-none"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%)',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <div className="flex-1 border-l-4 border-[#0d5c3a] pl-2.5 print:pl-2">
            <span className="text-[9px] font-sans font-bold text-[#0d5c3a] uppercase tracking-wider block print:text-[8px]">AMOUNT RECEIVED IN WORDS / مبلغ حرفی</span>
            <p className="text-xs sm:text-sm font-sans font-bold italic text-slate-800 mt-0.5 capitalize print:text-xs leading-relaxed">
              {amountWords}
            </p>
          </div>

          <div
            className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-lg text-center min-w-[160px] sm:min-w-[180px] print:px-3.5 print:py-1 print:min-w-[160px]"
            style={{
              backgroundColor: '#0d5c3a',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-[9px] font-sans uppercase tracking-wider block font-bold text-emerald-100 print:text-[8px]">TOTAL AMOUNT PAID</span>
            <div className="text-base sm:text-lg font-sans font-black tracking-tight text-white mt-0.5 print:text-base">
              Rs. {Number(booking.amount || 0).toLocaleString()}/-
            </div>
          </div>
        </div>

        {/* 4-Column Official Signatures Lockup */}
        <div className="pt-2 sm:pt-2.5 pb-0.5 grid grid-cols-4 items-end gap-2 text-center border-t border-slate-200 print:pt-1.5 print:pb-0">
          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-26 border-b-2 border-slate-700 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-xs leading-relaxed">وصول کنندہ</span>
            <span className="text-[8px] font-sans text-slate-500 font-bold print:text-[7px] uppercase tracking-wider">Received By</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-26 border-b-2 border-slate-700 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-xs leading-relaxed">رعایت کی منظوری</span>
            <span className="text-[8px] font-sans text-slate-500 font-bold print:text-[7px] uppercase tracking-wider">Discount Approval</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-26 border-b-2 border-slate-700 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-xs leading-relaxed">بکنگ کلرک</span>
            <span className="text-[8px] font-sans text-slate-500 font-bold print:text-[7px] uppercase tracking-wider">Booking Officer</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-26 border-b-2 border-slate-700 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-xs leading-relaxed">جنرل سیکریٹری</span>
            <span className="text-[8px] font-sans text-slate-500 font-bold print:text-[7px] uppercase tracking-wider">General Secretary</span>
          </div>
        </div>
      </div>

      {/* Official Footer Notice */}
      <div className="mt-1.5 pt-1 sm:mt-2 sm:pt-1.5 border-t border-slate-200 text-center print:mt-1 print:pt-0.5">
        <p className="text-[11px] sm:text-xs font-bold text-slate-600 print:text-[10px] leading-relaxed">
          ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا اختیار ہوگا۔
        </p>
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

