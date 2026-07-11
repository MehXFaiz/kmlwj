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
      className={`w-full max-w-[960px] print:max-w-full bg-white border border-slate-300 print:border-none p-6 sm:p-8 print:p-5 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-xl print:shadow-none rounded-2xl print:rounded-none box-border ${
        !isLast ? 'print:break-after-page mb-10 print:mb-0' : ''
      }`}
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Subtle Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
        <img src={logoImg} alt="Watermark" className="w-[420px] h-[420px] object-contain" />
      </div>

      {/* Header Block */}
      <div className="relative z-10 border-b-2 border-[#1a6e35] pb-6 mb-7">
        <div className="flex items-start justify-between gap-6">
          {/* Right Emblem */}
          <div className="w-24 h-24 shrink-0 flex items-center justify-center">
            <img src={logoImg} alt="Logo" className="w-22 h-22 object-contain" />
          </div>

          {/* Center Main Title */}
          <div className="flex-1 text-center pt-1">
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#1a6e35] leading-tight">
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-600 mt-2">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی
            </p>
            <p className="text-xs font-sans font-bold text-slate-500 mt-0.5">
              REGISTERED NO: 1319
            </p>
          </div>

          {/* Left Receipt Number & Copy Type */}
          <div className="shrink-0 flex flex-col items-end text-left font-sans">
            <div
              className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white mb-3"
              style={{
                backgroundColor: isCustomer ? '#1a6e35' : '#1e3a8a',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              {copyEnglishTitle}
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-bold uppercase block tracking-wider">RECEIPT NO</span>
              <span className="text-3xl font-black text-[#1a6e35] block leading-none mt-0.5">
                #{booking.receiptNo || '1'}
              </span>
              <span className="text-sm font-bold text-slate-700 font-urdu mt-1 block">
                {copyUrduTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Spacious Ledger Table */}
      <div className="relative z-10 space-y-8">
        {/* Customer & Booking Details Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div
            className="px-6 py-2.5 flex items-center justify-between text-sm font-bold border-b border-slate-300"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-base font-bold text-[#1a6e35]">معلوماتِ بکنگ کنندہ (Customer &amp; Booking Information)</span>
            <span className="font-sans font-bold text-slate-700">Booking Date: {bookingDateStr}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">نام بکنگ کنندہ (Booker Name):</span>
                <span className="text-xl font-bold text-slate-900">{booking.bookerName || '—'}</span>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">رابطہ نمبر (Mobile No):</span>
                <span className="text-lg font-sans font-bold text-[#1a6e35]" dir="ltr">{booking.mobile || '—'}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">بکنگ برائے جماعت (Jamaat Member):</span>
                <span className="text-base font-bold text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-md border border-emerald-300">
                  {booking.isForJamaat ? 'ہاں (Yes - Community Member)' : 'نہیں (No - General)'}
                </span>
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">پتہ (Address):</span>
                <span className="text-base font-medium text-slate-800 text-left">{booking.address || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Schedule & Venue Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div
            className="px-6 py-2.5 flex items-center justify-between text-sm font-bold border-b border-slate-300"
            style={{
              backgroundColor: '#f8fafc',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-base font-bold text-[#1a6e35]">تفصیلاتِ تقریب و ہال (Event Schedule &amp; Venue Details)</span>
            <span className="font-bold text-slate-700">بروز: {programDayUrdu}</span>
          </div>

          <div className="divide-y divide-slate-200 text-slate-800">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
              <div className="p-4">
                <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Program Date / تاریخِ تقریب</span>
                <span className="text-2xl font-sans font-extrabold text-[#1a6e35] block mt-1">{programDateStr}</span>
                <span className="text-xs text-slate-500 font-bold block mt-0.5">بروز: {programDayUrdu}</span>
              </div>

              <div className="p-4">
                <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Event Type / پروگرام کی نوعیت</span>
                <span className="text-xl font-bold text-slate-900 block mt-1">{booking.programType || 'تقریب'}</span>
              </div>

              <div className="p-4">
                <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Event Timings / اوقات</span>
                <span className="text-xl font-sans font-bold text-slate-900 block mt-1">{booking.timings || 'Evening'}</span>
              </div>
            </div>

            {/* Row 2: Selected Hall Checklist */}
            <div className="p-5 bg-slate-50/50">
              <span className="text-xs font-sans font-bold text-slate-500 uppercase block mb-3">Selected Community Hall / منتخب کردہ ہال:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {hallsList.map((hall) => (
                  <div
                    key={hall.id}
                    className={`p-3 rounded-xl border text-center transition-all ${
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
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {hall.selected && <Check className="h-4 w-4 text-[#1a6e35] stroke-[3]" />}
                      <span className={`text-lg font-bold ${hall.selected ? 'text-[#1a6e35]' : 'text-slate-600'}`}>
                        {hall.urduName}
                      </span>
                    </div>
                    <span className="text-[11px] font-sans text-slate-500 block">
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
          className="border-2 border-[#1a6e35] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{
            backgroundColor: '#f8fafc',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <div className="flex-1">
            <span className="text-xs font-sans font-bold text-slate-500 uppercase tracking-wider block">AMOUNT RECEIVED IN WORDS / مبلغ حرفی</span>
            <p className="text-base font-sans font-bold italic text-slate-800 mt-1 capitalize">
              {amountWords}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              * This receipt acknowledges full reservation of the selected community hall.
            </p>
          </div>

          <div
            className="px-8 py-4 rounded-xl text-center min-w-[240px]"
            style={{
              backgroundColor: '#1a6e35',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-xs font-sans uppercase tracking-wider block font-bold text-emerald-100">TOTAL AMOUNT PAID</span>
            <div className="text-3xl font-sans font-black tracking-tight text-white mt-1">
              Rs. {Number(booking.amount || 0).toLocaleString()}/-
            </div>
          </div>
        </div>

        {/* Signatures & Official Stamp */}
        <div className="pt-12 pb-4 grid grid-cols-3 items-end gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="w-48 border-b-2 border-slate-800 pb-1 mb-2"></div>
            <span className="text-base font-bold text-slate-800">دستخط بکنگ کلرک</span>
            <span className="text-xs font-sans text-slate-500">Booking Officer Signature</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#1a6e35]/60 flex flex-col items-center justify-center p-1 text-[#1a6e35]">
              <span className="text-[9px] font-sans font-bold tracking-wider">OFFICIAL SEAL</span>
              <span className="text-sm font-bold my-0.5">تصدیق شدہ</span>
              <span className="text-[8px] font-sans">KMLWJ LYARI</span>
            </div>
          </div>

          <div className="flex flex-col items-center relative">
            <span
              className="absolute -top-7 text-2xl text-slate-400 font-bold opacity-60 select-none pointer-events-none"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', serif" }}
            >
              جنرل سیکریٹری
            </span>
            <div className="w-48 border-b-2 border-slate-800 pb-1 mb-2"></div>
            <span className="text-base font-bold text-slate-800">دستخط جنرل سیکریٹری</span>
            <span className="text-xs font-sans text-slate-500">General Secretary Signature</span>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-8 pt-4 border-t border-slate-300 text-center">
        <p className="text-sm font-bold text-slate-700">
          ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا مکمل اختیار حاصل ہوگا۔
        </p>
        <p className="text-xs font-sans text-slate-400 mt-1">
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md print:p-0 print:bg-white print:backdrop-blur-none overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden border border-slate-200">
        
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
              body * {
                visibility: hidden !important;
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
                margin: 8mm;
              }
            }
          `}</style>

          <div id="print-receipt-wrapper" className="w-full max-w-[1000px] print:max-w-full flex flex-col items-center">
            {/* Customer Copy */}
            {(printMode === 'both' || printMode === 'customer') && (
              <SpaciousReceiptPage
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

