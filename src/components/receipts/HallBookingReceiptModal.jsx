import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Calendar, Clock, MapPin, User, Phone, FileText, Award } from 'lucide-react';
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

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!booking) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md print:p-0 print:bg-white print:backdrop-blur-none overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden border border-slate-200">
        
        {/* Actions Bar (Hidden in Print) */}
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Official Hall Booking Receipt</h2>
              <p className="text-xs text-slate-400">High-Resolution Executive Document Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Document
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
        <div className="overflow-y-auto print:overflow-visible bg-slate-100/60 print:bg-white flex justify-center p-4 sm:p-8 print:p-0">
          <div
            id="print-receipt"
            className="w-[820px] bg-white border-2 border-[#0f4d26]/80 print:border-none p-8 font-urdu relative text-slate-900 mx-auto leading-relaxed shadow-xl print:shadow-none rounded-xl print:rounded-none overflow-hidden"
            style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            dir="rtl"
          >
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-receipt, #print-receipt * {
                  visibility: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #print-receipt {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: 1px solid #1a6e35 !important;
                  padding: 24px 32px !important;
                  box-shadow: none !important;
                }
              }
            `}</style>

            {/* Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
              <img src={logoImg} alt="Watermark" className="w-[450px] h-[450px] object-contain" />
            </div>

            {/* Top Ornamental Frame Header */}
            <div className="relative z-10 border-b-2 border-[#1a6e35]/30 pb-5 mb-5">
              <div className="flex items-center justify-between gap-6">
                
                {/* Right Logo & Emblem */}
                <div className="w-24 h-24 shrink-0 flex items-center justify-center p-1 bg-gradient-to-br from-[#1a6e35]/5 to-amber-500/5 rounded-2xl border border-[#1a6e35]/20 shadow-sm">
                  <img src={logoImg} alt="Logo" className="w-20 h-20 object-contain" />
                </div>

                {/* Center Title Block */}
                <div className="flex-1 flex flex-col items-center text-center">
                  <div className="text-xs uppercase tracking-widest font-sans font-bold text-[#1a6e35] bg-[#1a6e35]/10 px-3.5 py-0.5 rounded-full border border-[#1a6e35]/20 mb-1.5">
                    Official Reservation Certificate
                  </div>
                  <h1 className="text-4xl sm:text-[38px] font-extrabold text-[#1a6e35] tracking-normal leading-tight drop-shadow-sm">
                    کچھی مسلم لوھارواڑھا ویلفیئر جماعت
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                    جمعہ بلوچ روڈ، نزد K.E گرڈ اسٹیشن، نیو کلری، لیاری، کراچی &nbsp;|&nbsp; <span className="font-sans font-bold">Reg. No: 1319</span>
                  </p>
                </div>

                {/* Left Receipt Number Badge */}
                <div className="shrink-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a6e35] to-[#0f4d26] text-white rounded-2xl px-5 py-3 shadow-md border border-emerald-400/30 min-w-[130px]">
                  <span className="text-xs font-sans tracking-widest uppercase opacity-90 font-bold">RECEIPT NO.</span>
                  <span className="text-3xl font-sans font-black tracking-tight my-0.5">
                    #{booking.receiptNo || '1'}
                  </span>
                  <span className="text-xs text-emerald-200 font-bold border-t border-emerald-400/40 pt-1 w-full text-center">
                    بکنگ رسید
                  </span>
                </div>

              </div>
            </div>

            {/* Main Content Sections */}
            <div className="relative z-10 space-y-5">

              {/* Section 1: Customer & Booking Metadata */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-950/[0.02] border border-slate-300/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-[#1a6e35] px-4 py-2 text-white flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-300" /> معلوماتِ بکنگ کنندہ (Customer Details)
                  </h3>
                  <span className="text-xs font-sans font-semibold bg-white/15 px-2.5 py-0.5 rounded-full">
                    Date: {bookingDateStr}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-800">
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Booker Name / نام بکنگ کنندہ</span>
                    <span className="text-xl font-bold text-slate-900 block mt-0.5">{booking.bookerName || '—'}</span>
                  </div>

                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Mobile No / رابطہ نمبر</span>
                    <span className="text-xl font-sans font-bold text-[#1a6e35] block mt-0.5" dir="ltr">{booking.mobile || '—'}</span>
                  </div>

                  <div>
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Jamaat Member / بکنگ برائے جماعت</span>
                    <span className="inline-flex items-center gap-1.5 text-base font-bold mt-1 px-3 py-0.5 rounded-lg border bg-emerald-50 border-emerald-300 text-emerald-800">
                      {booking.isForJamaat ? 'ہاں (Yes - Community Member)' : 'نہیں (No - General)'}
                    </span>
                  </div>

                  <div className="sm:col-span-3 pt-2 border-t border-slate-200">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Full Address / مکمل پتہ</span>
                    <span className="text-base font-medium text-slate-800 block mt-0.5">{booking.address || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Program & Event Timings */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-950/[0.02] border border-slate-300/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-[#1a6e35] px-4 py-2 text-white flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-300" /> تفصیلاتِ تقریب (Event Schedule)
                  </h3>
                  <span className="text-xs font-sans font-semibold bg-white/15 px-2.5 py-0.5 rounded-full">
                    Day: {programDayUrdu}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-800">
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Program Date / تاریخِ تقریب</span>
                    <span className="text-2xl font-sans font-extrabold text-[#1a6e35] block mt-0.5 tracking-tight">{programDateStr}</span>
                    <span className="text-xs text-slate-500 font-bold block">بروز: {programDayUrdu}</span>
                  </div>

                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Event Type / پروگرام کی نوعیت</span>
                    <span className="text-xl font-bold text-slate-900 block mt-0.5">{booking.programType || 'تقریب'}</span>
                  </div>

                  <div>
                    <span className="text-xs font-sans font-bold text-slate-500 uppercase block">Event Timings / اوقاتِ تقریب</span>
                    <span className="text-xl font-sans font-bold text-slate-900 block mt-0.5">{booking.timings || 'Evening'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Hall Allocation Selection Grid */}
              <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-800 px-4 py-2 text-white flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" /> منتخب کردہ ہال (Allocated Community Hall)
                  </h3>
                  <span className="text-xs font-sans font-semibold text-amber-400">Verified Facility</span>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3.5">
                  {hallsList.map((hall) => (
                    <div
                      key={hall.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                        hall.selected
                          ? 'border-[#1a6e35] bg-[#1a6e35]/[0.08] shadow-sm'
                          : 'border-slate-200 bg-slate-50/70 opacity-55'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-xl font-bold ${hall.selected ? 'text-[#1a6e35]' : 'text-slate-600'}`}>
                          {hall.urduName}
                        </span>
                        <span className="text-xs font-sans font-medium text-slate-500">
                          {hall.englishName}
                        </span>
                      </div>

                      <div>
                        {hall.selected ? (
                          <span className="flex items-center gap-1 bg-[#1a6e35] text-white px-3 py-1 rounded-lg text-xs font-sans font-bold shadow-xs">
                            ✓ SELECTED
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-300"></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Financial Summary & Total Received */}
              <div className="bg-gradient-to-r from-[#1a6e35]/10 via-emerald-50 to-amber-500/10 border-2 border-[#1a6e35]/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[#1a6e35] font-bold text-sm">
                    <ShieldCheck className="h-5 w-5" />
                    <span>کل وصولیابی رقم (TOTAL AMOUNT RECEIVED)</span>
                  </div>
                  <p className="text-sm font-sans font-semibold italic text-slate-700 mt-1 capitalize">
                    {amountWords}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    * This receipt confirms official reservation of the selected venue.
                  </p>
                </div>

                <div className="bg-[#1a6e35] text-white px-7 py-4 rounded-xl shadow-md flex flex-col items-center min-w-[220px]">
                  <span className="text-xs font-sans uppercase tracking-wider text-emerald-200 font-bold">TOTAL PAID / وصولیابی</span>
                  <div className="text-3xl font-sans font-black tracking-tight mt-0.5">
                    Rs. {Number(booking.amount || 0).toLocaleString()}/-
                  </div>
                </div>
              </div>

              {/* Official Signatures & Seal Block */}
              <div className="pt-8 pb-3 grid grid-cols-3 items-end gap-6 text-center border-t border-slate-200">
                {/* Booking Clerk Signature */}
                <div className="flex flex-col items-center">
                  <div className="w-48 border-b-2 border-slate-800 pb-1 mb-2"></div>
                  <span className="text-base font-bold text-slate-800">دستخط بکنگ کلرک</span>
                  <span className="text-xs font-sans text-slate-500">Booking Officer</span>
                </div>

                {/* Official Seal / Stamp */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#1a6e35]/40 flex flex-col items-center justify-center p-2 text-[#1a6e35] opacity-80 select-none">
                    <span className="text-[10px] font-sans font-bold tracking-wider">OFFICIAL SEAL</span>
                    <span className="text-sm font-bold my-0.5">تصدیق شدہ</span>
                    <span className="text-[9px] font-sans">KMLWJ LYARI</span>
                  </div>
                </div>

                {/* General Secretary Signature */}
                <div className="flex flex-col items-center relative">
                  <span
                    className="absolute -top-7 text-2xl text-slate-400 font-bold opacity-60 select-none pointer-events-none"
                    style={{ fontFamily: "'Jameel Noori Nastaleeq', serif" }}
                  >
                    جنرل سیکریٹری
                  </span>
                  <div className="w-48 border-b-2 border-slate-800 pb-1 mb-2"></div>
                  <span className="text-base font-bold text-slate-800">دستخط جنرل سیکریٹری</span>
                  <span className="text-xs font-sans text-slate-500">General Secretary</span>
                </div>
              </div>

            </div>

            {/* Official Terms Footer */}
            <div className="mt-6 pt-3 border-t-2 border-[#1a6e35]/20 bg-slate-50/80 print:bg-transparent rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-slate-700">
                ہدایات: پشت پر لکھی ہوئی تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا مکمل اختیار حاصل ہوگا۔
              </p>
              <p className="text-[11px] font-sans text-slate-400 mt-1">
                Kutchi Muslim Loharwadha Welfare Jamaat Lyari Karachi &bull; Official Booking Certificate &bull; Printed on {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

