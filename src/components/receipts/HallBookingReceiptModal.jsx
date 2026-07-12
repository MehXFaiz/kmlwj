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
      className="w-full max-w-[780px] print:max-w-full bg-white border border-slate-300 print:border-slate-300 p-5 sm:p-6 print:p-3.5 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-xl print:shadow-none rounded-2xl print:rounded-lg box-border"
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Subtle Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none z-0">
        <img src={logoImg} alt="Watermark" className="w-[260px] h-[260px] object-contain" />
      </div>

      {/* Header Block */}
      <div className="relative z-10 border-b-2 border-[#1a6e35] pb-2 sm:pb-3 mb-2.5 sm:mb-3 print:pb-1.5 print:mb-2">
        <div className="flex items-start justify-between gap-4">
          {/* Right Emblem */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center print:w-12 print:h-12">
            <img src={logoImg} alt="Logo" className="w-11 h-11 sm:w-15 sm:h-15 print:w-11 print:h-11 object-contain" />
          </div>

          {/* Center Main Title */}
          <div className="flex-1 text-center pt-0.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-[#1a6e35] leading-tight print:text-lg">
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-[11px] sm:text-xs font-bold text-slate-600 mt-0.5 print:text-[10px]">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
            </p>
            <p className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500">
              REGISTERED NO: 1319
            </p>
          </div>

          {/* Left Receipt Number & Copy Type */}
          <div className="shrink-0 flex flex-col items-end text-left font-sans">
            <div
              className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white mb-1 print:mb-0.5 print:px-2 print:py-0.5 print:text-[9px]"
              style={{
                backgroundColor: isCustomer ? '#1a6e35' : '#1e3a8a',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              {copyEnglishTitle}
            </div>
            <div className="text-right">
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase block tracking-wider print:text-[8px]">RECEIPT NO</span>
              <span className="text-lg sm:text-xl font-black text-[#1a6e35] block leading-none print:text-lg">
                #{booking.receiptNo || '1'}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 font-urdu block print:text-[10px]">
                {copyUrduTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tables */}
      <div className="relative z-10 space-y-2.5 sm:space-y-3 print:space-y-2">
        {/* Customer & Booking Details Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden print:rounded-lg">
          <div
            className="px-3.5 py-1 sm:px-4 sm:py-1.5 flex items-center justify-between text-xs font-bold border-b border-slate-300 print:px-3 print:py-1"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-xs sm:text-sm font-bold text-[#1a6e35] print:text-xs">معلوماتِ بکنگ کنندہ (Customer &amp; Booking Information)</span>
            <span className="font-sans font-bold text-slate-700 text-[11px] print:text-[10px]">Booking Date: {bookingDateStr}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2.5 flex items-center justify-between print:p-1.5">
                <span className="text-xs font-bold text-slate-500 print:text-[11px]">نام بکنگ کنندہ (Booker Name):</span>
                <span className="text-base sm:text-lg font-bold text-slate-900 print:text-base">{booking.bookerName || '—'}</span>
              </div>
              <div className="p-1.5 sm:p-2.5 flex items-center justify-between print:p-1.5">
                <span className="text-xs font-bold text-slate-500 print:text-[11px]">رابطہ نمبر (Mobile No):</span>
                <span className="text-sm sm:text-base font-sans font-bold text-[#1a6e35] print:text-sm" dir="ltr">{booking.mobile || '—'}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2.5 flex items-center justify-between print:p-1.5">
                <span className="text-xs font-bold text-slate-500 print:text-[11px]">بکنگ برائے جماعت (Jamaat Member):</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 print:text-[11px] print:px-1.5">
                  {booking.isForJamaat ? 'ہاں (Yes - Community Member)' : 'نہیں (No - General)'}
                </span>
              </div>
              <div className="p-1.5 sm:p-2.5 flex items-center justify-between print:p-1.5">
                <span className="text-xs font-bold text-slate-500 print:text-[11px]">پتہ (Address):</span>
                <span className="text-xs sm:text-sm font-medium text-slate-800 text-left print:text-xs">{booking.address || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Schedule & Venue Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden print:rounded-lg">
          <div
            className="px-3.5 py-1 sm:px-4 sm:py-1.5 flex items-center justify-between text-xs font-bold border-b border-slate-300 print:px-3 print:py-1"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-xs sm:text-sm font-bold text-[#1a6e35] print:text-xs">تفصیلاتِ تقریب و ہال (Event Schedule &amp; Venue Details)</span>
            <span className="font-bold text-slate-700 text-[11px] print:text-[10px]">بروز: {programDayUrdu}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-1.5 sm:p-2.5 print:p-1.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Program Date / تاریخِ تقریب</span>
                <span className="text-base sm:text-lg font-sans font-extrabold text-[#1a6e35] block print:text-sm">{programDateStr}</span>
                <span className="text-[10px] text-slate-500 font-bold block print:text-[9px]">بروز: {programDayUrdu}</span>
              </div>

              <div className="p-1.5 sm:p-2.5 print:p-1.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Event Type / پروگرام کی نوعیت</span>
                <span className="text-base sm:text-lg font-bold text-slate-900 block print:text-sm">{booking.programType || 'تقریب'}</span>
              </div>

              <div className="p-1.5 sm:p-2.5 print:p-1.5">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase block print:text-[8px]">Event Timings / اوقات</span>
                <span className="text-base sm:text-lg font-sans font-bold text-slate-900 block print:text-sm">{booking.timings || 'Evening'}</span>
              </div>
            </div>

            {/* Row 2: Selected Hall Checklist */}
            <div className="p-2 sm:p-3 bg-slate-50/50 print:p-1.5">
              <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500 uppercase block mb-1 print:text-[9px] print:mb-1">Selected Community Hall / منتخب کردہ ہال:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {hallsList.map((hall) => (
                  <div
                    key={hall.id}
                    className={`p-1 sm:p-2 rounded-lg border text-center transition-all print:p-1 ${
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
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      {hall.selected && <Check className="h-3 w-3 text-[#1a6e35] stroke-[3]" />}
                      <span className={`text-xs sm:text-sm font-bold print:text-xs ${hall.selected ? 'text-[#1a6e35]' : 'text-slate-600'}`}>
                        {hall.urduName}
                      </span>
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-sans text-slate-500 block print:text-[8px]">
                      {hall.englishName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Banner */}
        <div
          className="border border-[#1a6e35] rounded-xl p-2.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:p-2 print:rounded-lg"
          style={{
            backgroundColor: '#f8fafc',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <div className="flex-1">
            <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-500 uppercase tracking-wider block print:text-[8px]">AMOUNT RECEIVED IN WORDS / مبلغ حرفی</span>
            <p className="text-xs sm:text-sm font-sans font-bold italic text-slate-800 mt-0.5 capitalize print:text-xs">
              {amountWords}
            </p>
          </div>

          <div
            className="px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl text-center min-w-[160px] sm:min-w-[180px] print:px-3 print:py-1.5 print:min-w-[160px]"
            style={{
              backgroundColor: '#1a6e35',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-[9px] sm:text-[10px] font-sans uppercase tracking-wider block font-bold text-emerald-100 print:text-[8px]">TOTAL AMOUNT PAID</span>
            <div className="text-base sm:text-xl font-sans font-black tracking-tight text-white mt-0.5 print:text-base">
              Rs. {Number(booking.amount || 0).toLocaleString()}/-
            </div>
          </div>
        </div>

        {/* 4-Column Compact Signatures Row */}
        <div className="pt-2 sm:pt-3 pb-1 grid grid-cols-4 items-end gap-3 text-center border-t border-slate-200 print:pt-2 print:pb-0.5">
          <div className="flex flex-col items-center">
            <div className="w-24 sm:w-32 border-b border-slate-800 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-[11px]">وصول کنندہ</span>
            <span className="text-[9px] font-sans text-slate-500 font-bold print:text-[8px]">Received By</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-24 sm:w-32 border-b border-slate-800 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-[11px]">رعایت کی منظوری</span>
            <span className="text-[9px] font-sans text-slate-500 font-bold print:text-[8px]">Discount Approval</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-24 sm:w-32 border-b border-slate-800 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-[11px]">بکنگ کلرک</span>
            <span className="text-[9px] font-sans text-slate-500 font-bold print:text-[8px]">Booking Officer</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-24 sm:w-32 border-b border-slate-800 pb-0.5 mb-1 print:w-20"></div>
            <span className="text-xs sm:text-sm font-bold text-slate-800 print:text-[11px]">جنرل سیکریٹری</span>
            <span className="text-[9px] font-sans text-slate-500 font-bold print:text-[8px]">General Secretary</span>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-2 pt-1.5 sm:mt-3 sm:pt-2 border-t border-slate-200 text-center print:mt-1.5 print:pt-1">
        <p className="text-[11px] sm:text-xs font-bold text-slate-700 print:text-[10px]">
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
                margin: 6mm;
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

            {/* Cut Line Separator Between Customer & Office Copies */}
            {printMode === 'both' && (
              <div className="w-full my-3 print:my-2 flex items-center gap-2 text-slate-400 select-none">
                <div className="flex-1 border-b-2 border-dashed border-slate-400"></div>
                <div className="flex items-center gap-1.5 text-[11px] print:text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 print:bg-white px-3 py-0.5 rounded-full border border-slate-300 print:border-slate-400">
                  <span>✂</span>
                  <span>یہاں سے کاٹ کر علیحدہ کریں / Cut &amp; Separate Copies</span>
                </div>
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

