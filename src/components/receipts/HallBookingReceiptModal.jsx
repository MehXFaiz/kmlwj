import React, { useEffect, useState } from 'react';
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
      className={`w-full max-w-[960px] print:max-w-full bg-white border border-slate-300 print:border-none p-6 sm:p-8 print:p-2 print:py-1 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-xl print:shadow-none rounded-2xl print:rounded-none box-border ${
        !isLast ? 'print-page-break mb-6 print:mb-0' : ''
      }`}
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Subtle Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none z-0">
        <img src={logoImg} alt="Watermark" className="w-[320px] h-[320px] object-contain" />
      </div>

      {/* Header Block */}
      <div className="relative z-10 border-b-2 border-[#1a6e35] pb-2 sm:pb-6 mb-3 sm:mb-7 print:pb-2 print:mb-3">
        <div className="flex items-start justify-between gap-6">
          {/* Right Emblem */}
          <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center print:w-16 print:h-16">
            <img src={logoImg} alt="Logo" className="w-14 h-14 sm:w-22 sm:h-22 print:w-14 print:h-14 object-contain" />
          </div>

          {/* Center Main Title */}
          <div className="flex-1 text-center pt-1">
            <h1 className="text-xl sm:text-[28px] font-extrabold text-[#1a6e35] leading-tight print:text-xl">
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-600 mt-1 sm:mt-2 print:mt-0.5 print:text-[10px]">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
            </p>
            <p className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 mt-0.5">
              REGISTERED NO: 1319
            </p>
          </div>

          {/* Left Receipt Number & Copy Type */}
          <div className="shrink-0 flex flex-col items-end text-left font-sans">
            <div
              className="px-2 py-0.5 sm:px-3.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white mb-1.5 sm:mb-3 print:mb-1 print:px-2 print:py-0.5 print:text-[10px]"
              style={{
                backgroundColor: isCustomer ? '#1a6e35' : '#1e3a8a',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              {copyEnglishTitle}
            </div>
            <div className="text-right">
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase block tracking-wider print:text-[9px]">RECEIPT NO</span>
              <span className="text-xl sm:text-3xl font-black text-[#1a6e35] block leading-none mt-0.5 print:text-xl">
                #{booking.receiptNo || '1'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-700 font-urdu mt-0.5 sm:mt-1 block print:text-xs">
                {copyUrduTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Spacious Ledger Table */}
      <div className="relative z-10 space-y-4 sm:space-y-8 print:space-y-2">
        {/* Customer & Booking Details Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div
            className="px-4 py-1.5 sm:px-6 sm:py-2.5 flex items-center justify-between text-sm font-bold border-b border-slate-300 print:px-4 print:py-1"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-sm sm:text-base font-bold text-[#1a6e35] print:text-sm">معلوماتِ بکنگ کنندہ (Customer &amp; Booking Information)</span>
            <span className="font-sans font-bold text-slate-700 print:text-xs">Booking Date: {bookingDateStr}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-2 sm:p-4 flex items-center justify-between print:p-2">
                <span className="text-xs sm:text-sm font-bold text-slate-500 print:text-xs">نام بکنگ کنندہ (Booker Name):</span>
                <span className="text-lg sm:text-xl font-bold text-slate-900 print:text-lg">{booking.bookerName || '—'}</span>
              </div>
              <div className="p-2 sm:p-4 flex items-center justify-between print:p-2">
                <span className="text-xs sm:text-sm font-bold text-slate-500 print:text-xs">رابطہ نمبر (Mobile No):</span>
                <span className="text-base sm:text-lg font-sans font-bold text-[#1a6e35] print:text-base" dir="ltr">{booking.mobile || '—'}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-2 sm:p-4 flex items-center justify-between print:p-2">
                <span className="text-xs sm:text-sm font-bold text-slate-500 print:text-xs">بکنگ برائے جماعت (Jamaat Member):</span>
                <span className="text-sm sm:text-base font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 print:text-xs print:px-2">
                  {booking.isForJamaat ? 'ہاں (Yes - Community Member)' : 'نہیں (No - General)'}
                </span>
              </div>
              <div className="p-2 sm:p-4 flex items-center justify-between print:p-2">
                <span className="text-xs sm:text-sm font-bold text-slate-500 print:text-xs">پتہ (Address):</span>
                <span className="text-sm sm:text-base font-medium text-slate-800 text-left print:text-sm">{booking.address || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Schedule & Venue Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div
            className="px-4 py-1.5 sm:px-6 sm:py-2.5 flex items-center justify-between text-sm font-bold border-b border-slate-300 print:px-4 print:py-1"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-sm sm:text-base font-bold text-[#1a6e35] print:text-sm">تفصیلاتِ تقریب و ہال (Event Schedule &amp; Venue Details)</span>
            <span className="font-bold text-slate-700 print:text-xs">بروز: {programDayUrdu}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-2 sm:p-4 print:p-2">
                <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase block print:text-[9px]">Program Date / تاریخِ تقریب</span>
                <span className="text-xl sm:text-2xl font-sans font-extrabold text-[#1a6e35] block mt-0.5 sm:mt-1 print:text-lg">{programDateStr}</span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-bold block mt-0.5 print:text-[9px]">بروز: {programDayUrdu}</span>
              </div>

              <div className="p-2 sm:p-4 print:p-2">
                <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase block print:text-[9px]">Event Type / پروگرام کی نوعیت</span>
                <span className="text-lg sm:text-xl font-bold text-slate-900 block mt-0.5 sm:mt-1 print:text-base">{booking.programType || 'تقریب'}</span>
              </div>

              <div className="p-2 sm:p-4 print:p-2">
                <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase block print:text-[9px]">Event Timings / اوقات</span>
                <span className="text-lg sm:text-xl font-sans font-bold text-slate-900 block mt-0.5 sm:mt-1 print:text-base">{booking.timings || 'Evening'}</span>
              </div>
            </div>

            {/* Row 2: Selected Hall Checklist */}
            <div className="p-3 sm:p-5 bg-slate-50/50 print:p-2">
              <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase block mb-1.5 sm:mb-3 print:text-[9px] print:mb-1">Selected Community Hall / منتخب کردہ ہال:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {hallsList.map((hall) => (
                  <div
                    key={hall.id}
                    className={`p-1.5 sm:p-3 rounded-xl border text-center transition-all print:p-1.5 print:rounded-lg ${
                      hall.selected
                        ? 'border-[#1a6e35] bg-emerald-50 shadow-xs'
                        : 'border-slate-200 bg-white opacity-40'
                    }`}
                    style={
                      hall.selected
                        ? {
                            backgroundColor: '#f0fdf4',
                            borderColor: '#1a6e35',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact'
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                      {hall.selected && <Check className="h-3 w-3 sm:h-4 sm:w-4 text-[#1a6e35] stroke-[3]" />}
                      <span className={`text-sm sm:text-lg font-bold print:text-sm ${hall.selected ? 'text-[#1a6e35]' : 'text-slate-600'}`}>
                        {hall.urduName}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-sans text-slate-500 block print:text-[9px]">
                      {hall.englishName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spacious Financial Banner */}
        <div
          className="border-2 border-[#1a6e35] rounded-xl p-3 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 print:p-3"
          style={{
            backgroundColor: '#f8fafc',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <div className="flex-1">
            <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase tracking-wider block print:text-[10px]">AMOUNT RECEIVED IN WORDS / مبلغ حرفی</span>
            <p className="text-sm sm:text-base font-sans font-bold italic text-slate-800 mt-1 capitalize print:text-sm">
              {amountWords}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5 sm:mt-2 print:mt-1 print:text-[9px]">
              * This receipt acknowledges full reservation of the selected community hall.
            </p>
          </div>

          <div
            className="px-4 py-2 sm:px-8 sm:py-4 rounded-xl text-center min-w-[200px] sm:min-w-[240px] print:px-4 print:py-2 print:min-w-[200px]"
            style={{
              backgroundColor: '#1a6e35',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-[10px] sm:text-xs font-sans uppercase tracking-wider block font-bold text-emerald-100 print:text-[10px]">TOTAL AMOUNT PAID</span>
            <div className="text-xl sm:text-3xl font-sans font-black tracking-tight text-white mt-0.5 sm:mt-1 print:text-xl">
              Rs. {Number(booking.amount || 0).toLocaleString()}/-
            </div>
          </div>
        </div>

        {/* Additional Signature Fields: Received By & Discount Approval */}
        <div className="pt-3 pb-1 sm:pt-6 sm:pb-2 grid grid-cols-2 divide-x divide-slate-300 divide-x-reverse items-end gap-6 text-center border-t border-slate-200 print:pt-3 print:pb-1">
          <div className="flex flex-col items-center">
            <div className="w-44 sm:w-64 border-b border-slate-800 pb-1 mb-2 print:w-44"></div>
            <span className="text-sm sm:text-base font-bold text-slate-800 print:text-sm">وصول کنندہ</span>
            <span className="text-xs font-sans text-slate-500 font-bold print:text-[10px]">Received By</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-44 sm:w-64 border-b border-slate-800 pb-1 mb-2 print:w-44"></div>
            <span className="text-sm sm:text-base font-bold text-slate-800 print:text-sm">رعایت کی منظوری (دستخط اور نام)</span>
            <span className="text-xs font-sans text-slate-500 font-bold print:text-[10px]">Discount Approval Signature & Name</span>
          </div>
        </div>

        {/* Signatures & Official Stamp */}
        <div className="pt-4 pb-2 sm:pt-8 sm:pb-4 grid grid-cols-3 items-end gap-8 text-center border-t border-slate-200 print:pt-3 print:pb-1">
          <div className="flex flex-col items-center">
            <div className="w-36 sm:w-48 border-b-2 border-slate-800 pb-1 mb-2 print:w-36"></div>
            <span className="text-sm sm:text-base font-bold text-slate-800 print:text-sm">دستخط بکنگ کلرک</span>
            <span className="text-xs font-sans text-slate-500 print:text-[10px]">Booking Officer Signature</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-[#1a6e35]/60 flex flex-col items-center justify-center p-1 text-[#1a6e35] print:w-14 print:h-14">
              <span className="text-[8px] sm:text-[9px] font-sans font-bold tracking-wider print:text-[7px]">OFFICIAL SEAL</span>
              <span className="text-xs sm:text-sm font-bold my-0.5 print:text-xs">تصدیق شدہ</span>
              <span className="text-[7px] sm:text-[8px] font-sans print:text-[6px]">KMLWJ LYARI</span>
            </div>
          </div>

          <div className="flex flex-col items-center relative">
            <span
              className="absolute -top-5 sm:-top-7 text-lg sm:text-2xl text-slate-400 font-bold opacity-60 select-none pointer-events-none print:-top-5 print:text-lg"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', serif" }}
            >
              جنرل سیکریٹری
            </span>
            <div className="w-36 sm:w-48 border-b-2 border-slate-800 pb-1 mb-2 print:w-36"></div>
            <span className="text-sm sm:text-base font-bold text-slate-800 print:text-sm">دستخط جنرل سیکریٹری</span>
            <span className="text-xs font-sans text-slate-500 print:text-[10px]">General Secretary Signature</span>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-3 pt-2 sm:mt-8 sm:pt-4 border-t border-slate-300 text-center print:mt-2 print:pt-1">
        <p className="text-xs sm:text-sm font-bold text-slate-700 print:text-xs">
          ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا مکمل اختیار حاصل ہوگا۔
        </p>
        <p className="text-[10px] sm:text-xs font-sans text-slate-400 mt-1 print:text-[9px]">
          Kutchi Muslim Loharwadha Welfare Jamaat Lyari Karachi &bull; Official Booking Voucher &bull; Printed on {new Date().toLocaleDateString('en-GB')}
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

  return (
    <div id="print-receipt-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md print:absolute print:inset-auto print:top-0 print:left-0 print:w-full print:h-auto print:bg-white print:z-0 print:block print:overflow-visible overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none print:border-none print:w-full print:max-w-full print:overflow-visible overflow-hidden border border-slate-200">
        
        {/* Actions & Copy Mode Selector Bar (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white print:hidden shrink-0">
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
        <div className="overflow-y-auto print:overflow-visible bg-slate-100/60 print:bg-white flex flex-col items-center p-4 sm:p-8 print:p-0">
          <style>{`
            @media print {
              /* Hide standard web app elements */
              #root > div > *:not(.flex-1),
              aside, nav, header, footer, .sidebar, .topbar {
                display: none !important;
              }
              
              /* Hide all page content siblings of the print modal */
              .space-y-4 > *:not(#print-receipt-modal),
              .space-y-6 > *:not(#print-receipt-modal),
              .space-y-8 > *:not(#print-receipt-modal) {
                display: none !important;
              }

              body * {
                visibility: hidden !important;
              }
              #print-receipt-modal, #print-receipt-modal * {
                visibility: visible !important;
              }
              #print-receipt-wrapper, #print-receipt-wrapper * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #print-receipt-wrapper {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              @page {
                size: A4 landscape;
                margin: 6mm;
              }
              .print-page-break {
                page-break-after: always !important;
                break-after: page !important;
              }
            }
          `}</style>

          <div id="print-receipt-wrapper" className="w-full max-w-[1000px] print:max-w-full flex flex-col items-center">
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
    </div>
  );
};

