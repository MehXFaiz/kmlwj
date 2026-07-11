import React, { useEffect, useState } from 'react';
import { X, Printer, User, Calendar, Award, ShieldCheck, Copy, Scissors } from 'lucide-react';
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

const SingleReceiptCertificate = ({ booking, copyType, copyUrduTitle, copyEnglishTitle, badgeBg }) => {
  const bookingDateStr = formatDateDDMMYYYY(booking.bookingDate || booking.createdAt);
  const programDateStr = formatDateDDMMYYYY(booking.programDate);

  // Format day name in Urdu
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const programDayUrdu = booking.programDate ? daysUrdu[new Date(booking.programDate).getDay()] : '';

  const amountWords = numberToWords(booking.amount);

  // Identify hall
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
      className="w-full max-w-[730px] print:max-w-full bg-white border-2 border-[#1a6e35] p-5 sm:p-6 print:p-4 font-urdu relative text-slate-900 mx-auto leading-normal shadow-lg print:shadow-none rounded-xl print:rounded-none overflow-hidden box-border"
      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
      dir="rtl"
    >
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
        <img src={logoImg} alt="Watermark" className="w-[340px] h-[340px] object-contain" />
      </div>

      {/* Top Header Block */}
      <div className="relative z-10 border-b-2 border-[#1a6e35]/30 pb-3 mb-3">
        {/* Top Copy Type Pill */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="px-3 py-0.5 rounded-full text-xs font-sans font-extrabold uppercase tracking-wider text-white"
            style={{
              backgroundColor: isCustomer ? '#1a6e35' : '#1e3a8a',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            ● {copyEnglishTitle}
          </span>
          <span
            className="text-xs font-extrabold px-3 py-0.5 rounded-full border"
            style={{
              color: isCustomer ? '#1a6e35' : '#1e3a8a',
              borderColor: isCustomer ? '#86efac' : '#93c5fd',
              backgroundColor: isCustomer ? '#f0fdf4' : '#eff6ff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            {copyUrduTitle}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Right Emblem */}
          <div className="w-16 h-16 shrink-0 flex items-center justify-center p-1 bg-emerald-50 rounded-xl border border-[#1a6e35]/20">
            <img src={logoImg} alt="Logo" className="w-14 h-14 object-contain" />
          </div>

          {/* Center Title */}
          <div className="flex-1 flex flex-col items-center text-center px-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a6e35] leading-tight">
              کچھی مسلم لوھارواڑھا ویلفیئر جماعت
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
              جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی &nbsp;|&nbsp; <span className="font-sans font-bold">Reg: 1319</span>
            </p>
          </div>

          {/* Left Receipt Number Box */}
          <div
            className="shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-2 border text-white min-w-[110px]"
            style={{
              backgroundColor: '#1a6e35',
              borderColor: '#115e32',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-[10px] font-sans tracking-widest uppercase font-bold text-emerald-100">RECEIPT NO</span>
            <span className="text-2xl font-sans font-black tracking-tight my-0 text-white">
              #{booking.receiptNo || '1'}
            </span>
            <span className="text-[11px] text-emerald-100 font-bold">
              بکنگ رسید
            </span>
          </div>
        </div>
      </div>

      {/* Structured Sections */}
      <div className="relative z-10 space-y-3">
        {/* Section 1: Customer Details */}
        <div className="border border-[#1a6e35]/40 rounded-xl overflow-hidden bg-white">
          <div
            className="px-3.5 py-1 flex items-center justify-between text-xs font-bold border-b border-[#1a6e35]/30"
            style={{
              backgroundColor: '#f0fdf4',
              color: '#1a6e35',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <User className="h-3.5 w-3.5" /> معلوماتِ بکنگ کنندہ (Customer Details)
            </span>
            <span className="font-sans font-bold text-slate-700">Date: {bookingDateStr}</span>
          </div>

          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-800 text-sm">
            <div className="border-l border-slate-200 pl-2">
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Booker Name / نام بکنگ کنندہ</span>
              <span className="font-bold text-slate-900 block">{booking.bookerName || '—'}</span>
            </div>

            <div className="border-l border-slate-200 pl-2">
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Mobile No / رابطہ نمبر</span>
              <span className="font-sans font-bold text-[#1a6e35] block" dir="ltr">{booking.mobile || '—'}</span>
            </div>

            <div>
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Jamaat Member / برائے جماعت</span>
              <span className="inline-block text-xs font-bold mt-0.5 px-2 py-0.5 rounded border bg-emerald-50 border-emerald-300 text-emerald-800">
                {booking.isForJamaat ? 'ہاں (Community Member)' : 'نہیں (General)'}
              </span>
            </div>

            <div className="sm:col-span-3 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Address / پتہ</span>
              <span className="text-xs font-medium text-slate-800 block">{booking.address || '—'}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Program Schedule */}
        <div className="border border-[#1a6e35]/40 rounded-xl overflow-hidden bg-white">
          <div
            className="px-3.5 py-1 flex items-center justify-between text-xs font-bold border-b border-[#1a6e35]/30"
            style={{
              backgroundColor: '#f0fdf4',
              color: '#1a6e35',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Calendar className="h-3.5 w-3.5" /> تفصیلاتِ تقریب (Event Schedule)
            </span>
            <span className="font-bold text-slate-700">بروز: {programDayUrdu}</span>
          </div>

          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-800 text-sm">
            <div className="border-l border-slate-200 pl-2">
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Program Date / تاریخِ تقریب</span>
              <span className="text-base font-sans font-extrabold text-[#1a6e35] block tracking-tight">{programDateStr}</span>
            </div>

            <div className="border-l border-slate-200 pl-2">
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Event Type / پروگرام کی نوعیت</span>
              <span className="font-bold text-slate-900 block">{booking.programType || 'تقریب'}</span>
            </div>

            <div>
              <span className="text-[10px] font-sans font-bold text-slate-500 uppercase block">Timings / اوقات</span>
              <span className="font-sans font-bold text-slate-900 block">{booking.timings || 'Evening'}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Hall Allocation Summary */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
          <div
            className="px-3.5 py-1 flex items-center justify-between text-xs font-bold border-b border-slate-200"
            style={{
              backgroundColor: '#f8fafc',
              color: '#334155',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Award className="h-3.5 w-3.5 text-[#1a6e35]" /> منتخب کردہ ہال (Allocated Facility)
            </span>
            <span className="text-[11px] font-sans font-semibold text-emerald-700">Confirmed Booking</span>
          </div>

          <div className="p-2.5 grid grid-cols-2 gap-2">
            {hallsList.map((hall) => (
              <div
                key={hall.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                  hall.selected
                    ? 'border-[#1a6e35] bg-emerald-50/80 font-bold'
                    : 'border-slate-200 bg-slate-50/40 opacity-50'
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
                <div className="flex flex-col">
                  <span className={`text-base font-bold ${hall.selected ? 'text-[#1a6e35]' : 'text-slate-600'}`}>
                    {hall.urduName}
                  </span>
                  <span className="text-[10px] font-sans text-slate-500">
                    {hall.englishName}
                  </span>
                </div>

                <div>
                  {hall.selected ? (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-sans font-extrabold text-white"
                      style={{
                        backgroundColor: '#1a6e35',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    >
                      ✓ SELECTED
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-300 inline-block"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Total Amount Paid Banner */}
        <div
          className="border-2 border-[#1a6e35] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{
            backgroundColor: '#f0fdf4',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-[#1a6e35] font-bold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>کل وصولیابی رقم (TOTAL AMOUNT RECEIVED)</span>
            </div>
            <p className="text-xs font-sans font-bold italic text-slate-700 mt-0.5 capitalize">
              {amountWords}
            </p>
          </div>

          <div
            className="px-5 py-2 rounded-lg text-center min-w-[170px]"
            style={{
              backgroundColor: '#1a6e35',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          >
            <span className="text-[10px] font-sans uppercase tracking-wider block font-bold text-emerald-100">TOTAL PAID</span>
            <div className="text-xl font-sans font-black tracking-tight text-white">
              Rs. {Number(booking.amount || 0).toLocaleString()}/-
            </div>
          </div>
        </div>

        {/* Signature Block */}
        <div className="pt-4 pb-1 grid grid-cols-3 items-end gap-4 text-center border-t border-slate-200">
          <div className="flex flex-col items-center">
            <div className="w-36 border-b-2 border-slate-800 pb-0.5 mb-1"></div>
            <span className="text-xs font-bold text-slate-800">دستخط بکنگ کلرک</span>
            <span className="text-[10px] font-sans text-slate-500">Booking Officer</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full border border-dashed border-[#1a6e35]/60 flex flex-col items-center justify-center p-1 text-[#1a6e35]">
              <span className="text-[8px] font-sans font-bold">SEAL</span>
              <span className="text-[11px] font-bold">تصدیق شدہ</span>
            </div>
          </div>

          <div className="flex flex-col items-center relative">
            <span
              className="absolute -top-5 text-lg text-slate-400 font-bold opacity-60 select-none pointer-events-none"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', serif" }}
            >
              جنرل سیکریٹری
            </span>
            <div className="w-36 border-b-2 border-slate-800 pb-0.5 mb-1"></div>
            <span className="text-xs font-bold text-slate-800">دستخط جنرل سیکریٹری</span>
            <span className="text-[10px] font-sans text-slate-500">General Secretary</span>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-2.5 pt-1.5 border-t border-slate-200 text-center">
        <p className="text-[11px] font-bold text-slate-700">
          ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا مکمل اختیار حاصل ہوگا۔
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
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden border border-slate-200">
        
        {/* Actions & Copy Mode Selector Bar (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Official Hall Booking Receipt</h2>
              <p className="text-xs text-slate-400">Crisp High-Contrast Print Template</p>
            </div>
          </div>

          {/* Copy Selector Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPrintMode('both')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Copy className="h-3 w-3 inline mr-1.5" />
              Both Copies (1 Sheet)
            </button>
            <button
              onClick={() => setPrintMode('customer')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Customer Copy Only
            </button>
            <button
              onClick={() => setPrintMode('office')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'office'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Office Copy Only
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print
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
        <div className="overflow-y-auto print:overflow-visible bg-slate-100/60 print:bg-white flex flex-col items-center p-3 sm:p-6 print:p-0">
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
                size: A4 portrait;
                margin: 8mm;
              }
            }
          `}</style>

          <div id="print-receipt-wrapper" className="w-full max-w-[740px] print:max-w-full flex flex-col items-center">
            {/* Customer Copy */}
            {(printMode === 'both' || printMode === 'customer') && (
              <SingleReceiptCertificate
                booking={booking}
                copyType="customer"
                copyUrduTitle="صارف کاپی (Customer Copy)"
                copyEnglishTitle="CUSTOMER COPY"
              />
            )}

            {/* Scissor Cut Line Between Copies */}
            {printMode === 'both' && (
              <div
                className="w-full max-w-[730px] print:max-w-full my-4 flex items-center justify-center gap-3 select-none"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                <div className="flex-1 border-t-2 border-dashed border-slate-400"></div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-300 text-[11px] font-bold text-slate-600">
                  <Scissors className="h-3.5 w-3.5 text-emerald-700" />
                  <span>✂ CUT HERE / یہاں سے کاٹیں (OFFICE COPY BELOW)</span>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-slate-400"></div>
              </div>
            )}

            {/* Office Copy */}
            {(printMode === 'both' || printMode === 'office') && (
              <SingleReceiptCertificate
                booking={booking}
                copyType="office"
                copyUrduTitle="دفتری ریکارڈ کاپی (Office Record Copy)"
                copyEnglishTitle="OFFICE COPY"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

