import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Award,
  Building2,
  Calendar,
  User,
  Phone,
  MapPin,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoImg from '../../assets/logo.png';

const numberToWordsPKR = (num) => {
  if (!num || isNaN(num) || Number(num) === 0) return 'Zero Rupees Only';
  const n = Math.floor(Number(num));
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigitsToWords = (val) => {
    if (val === 0) return '';
    if (val < 20) return a[val] + ' ';
    return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '') + ' ';
  };

  const threeDigitsToWords = (val) => {
    let str = '';
    const hundred = Math.floor(val / 100);
    const rem = val % 100;
    if (hundred > 0) {
      str += a[hundred] + ' Hundred ';
    }
    if (rem > 0) {
      str += twoDigitsToWords(rem);
    }
    return str;
  };

  let str = '';
  const crore = Math.floor(n / 10000000);
  let remainder = n % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundredRem = remainder % 1000;

  if (crore > 0) str += twoDigitsToWords(crore) + 'Crore ';
  if (lakh > 0) str += twoDigitsToWords(lakh) + 'Lakh ';
  if (thousand > 0) str += twoDigitsToWords(thousand) + 'Thousand ';
  if (hundredRem > 0) str += threeDigitsToWords(hundredRem);

  return str.replace(/\s+/g, ' ').trim() + ' Rupees Only';
};

const formatDateDDMMYYYY = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d)) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getDayNameUrdu = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const daysUrdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  return daysUrdu[d.getDay()];
};

const getDayNameEnglish = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d)) return '';
  const daysEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return daysEnglish[d.getDay()];
};

const ReceiptPage = ({ booking, copyType, copyUrduTitle, copyEnglishTitle, isCompact }) => {
  const bookingDateStr = formatDateDDMMYYYY(booking.bookingDate || booking.createdAt || new Date());
  const programDateStr = formatDateDDMMYYYY(booking.programDate);
  const programDayUrdu = getDayNameUrdu(booking.programDate);
  const programDayEnglish = getDayNameEnglish(booking.programDate);
  const amountWords = numberToWordsPKR(booking.amount);

  const rawHallName = (
    booking.hallName ||
    booking.hallAccount?.accountName ||
    booking.hallAccount?.name ||
    ''
  ).toLowerCase();

  const isBagh =
    rawHallName.includes('bagh') ||
    rawHallName.includes('hajiani') ||
    rawHallName.includes('hajiyani') ||
    rawHallName.includes('باغ') ||
    rawHallName.includes('گارڈن');

  const isSadaBahar =
    rawHallName.includes('sada') ||
    rawHallName.includes('sadaya') ||
    rawHallName.includes('سدا');

  const isZakaria =
    rawHallName.includes('zakaria') ||
    rawHallName.includes('zikarya') ||
    rawHallName.includes('zikriya') ||
    rawHallName.includes('zakriya') ||
    rawHallName.includes('zakariya') ||
    rawHallName.includes('زکریا');

  const isGosha =
    rawHallName.includes('gosha') ||
    rawHallName.includes('annexy') ||
    rawHallName.includes('anexy') ||
    rawHallName.includes('anxy') ||
    rawHallName.includes('گوشہ') ||
    rawHallName.includes('اینیکسی');

  const hallsList = [
    {
      id: 'bagh',
      urduName: 'باغ حاجیانی گارڈن',
      englishName: 'Bagh-e-Hajiani Garden',
      selected: isBagh || (!isSadaBahar && !isZakaria && !isGosha && rawHallName.includes('bagh'))
    },
    {
      id: 'sada',
      urduName: 'صدایا ہال',
      englishName: 'Sadaya Hall',
      selected: isSadaBahar
    },
    {
      id: 'zakaria',
      urduName: 'زکریا ہال',
      englishName: 'Zakaria Hall',
      selected: isZakaria
    },
    {
      id: 'gosha',
      urduName: 'اینیکسی ہال (گوشہ)',
      englishName: 'Annexy Hall (Gosha)',
      selected: isGosha
    }
  ];

  const isCustomer = copyType === 'customer';

  return (
    <div
      className={`w-full max-w-[820px] print:max-w-full bg-white text-slate-900 mx-auto box-border transition-all ${
        isCompact ? 'p-2 sm:p-2.5 print:p-1.5' : 'p-3 sm:p-5 print:p-3'
      }`}
      style={{
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Outer Executive Double-Border Frame */}
      <div
        className={`relative bg-white border-2 border-slate-900 rounded-lg shadow-sm print:shadow-none overflow-hidden ${
          isCompact ? 'p-2.5 sm:p-3 print:p-2' : 'p-4 sm:p-6 print:p-4'
        }`}
      >
        {/* Inner Ornamental Accent Frame */}
        <div className="absolute inset-1.5 border border-slate-300 pointer-events-none rounded sm:inset-2" />

        {/* Subtle Watermark Emblem */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none z-0">
          <img src={logoImg} alt="Watermark" className="w-[280px] h-[280px] object-contain" />
        </div>

        {/* ══════════════════════════════════════════════════════════
           1. TOP VOUCHER BAR & INSTITUTION HEADER
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border-b-2 border-slate-900 pb-3 mb-3 print:pb-2 print:mb-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Block: Logo + Bilingual Organization Name */}
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center p-1 border border-slate-200 rounded-lg bg-slate-50">
              <img src={logoImg} alt="KMLWJ Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  کچھی مسلم لوھارواڑھا ویلفیئر جماعت
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                  REG # 1319
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-black text-slate-800 tracking-wide uppercase mt-1">
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAAT (REGD.)
              </h2>
              <p className="text-[11px] font-medium text-slate-600 mt-0.5 leading-snug">
                Juma Baloch Road, Near K.E. Grid Station, Nawalane, Lyari, Karachi
              </p>
            </div>
          </div>

          {/* Right Block: Official Voucher Number & Copy Badge */}
          <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            {/* Copy Badge */}
            <div
              className="px-3 py-1 rounded border text-right"
              style={{
                backgroundColor: isCustomer ? '#0f172a' : '#1e293b',
                borderColor: '#0f172a',
                color: '#ffffff'
              }}
            >
              <span className="text-[9px] uppercase tracking-widest font-bold text-slate-300 block">
                CLASSIFICATION
              </span>
              <span className="text-xs sm:text-sm font-black tracking-wide block">
                {copyEnglishTitle}
              </span>
              <span
                className="text-xs font-bold block mt-0.5 text-amber-200"
                style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
              >
                {copyUrduTitle}
              </span>
            </div>

            {/* Receipt No & Issue Date Pill */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-right">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  RECEIPT NO
                </span>
                <span className="text-sm font-black text-slate-900 font-mono block">
                  #{String(booking.receiptNo || '0001').padStart(4, '0')}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  ISSUE DATE
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  {bookingDateStr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Title Bar */}
        <div
          className="relative z-10 px-3.5 py-1.5 rounded-md mb-3 flex items-center justify-between shadow-xs"
          style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff'
          }}
        >
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              OFFICIAL HALL BOOKING RECEIPT & RESERVATION CERTIFICATE
            </span>
          </div>
          <span
            className="text-xs sm:text-sm font-bold text-amber-300"
            style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
          >
            باضابطہ رسید و تصدیق نامہ بکنگ ہال
          </span>
        </div>

        {/* ══════════════════════════════════════════════════════════
           2. BOOKER & MEMBERSHIP INFORMATION TABLE (SECTION 1)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded-md overflow-hidden mb-3 bg-white">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#334155' }}
          >
            <span>1. CLIENT & MEMBERSHIP PROFILE</span>
            <span
              className="text-xs font-bold"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              تفصیلاتِ بکنگ کنندہ و رکنیت
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
            {/* Booker Name */}
            <div className="p-2.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  BOOKER NAME
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  نام بکنگ کنندہ
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 truncate">
                {booking.bookerName || '—'}
              </div>
            </div>

            {/* Contact Phone */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  CONTACT NO.
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  رابطہ نمبر
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5 font-mono" dir="ltr">
                {booking.mobile || '—'}
              </div>
            </div>

            {/* Community Membership */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  MEMBERSHIP
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  حیثیت رکنیت
                </span>
              </div>
              <div className="mt-0.5">
                {booking.isForJamaat ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    <Check className="h-3 w-3 stroke-[3]" />
                    جماعت ممبر (Member)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    عام پبلک (General Public)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           3. EVENT & SCHEDULE SPECIFICATIONS TABLE (SECTION 2)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded-md overflow-hidden mb-3 bg-white">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#334155' }}
          >
            <span>2. EVENT SCHEDULE & PROGRAM SPECIFICATIONS</span>
            <span
              className="text-xs font-bold"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              تفصیلاتِ تقریب و اوقات
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
            {/* Event Date */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  EVENT DATE
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  تاریخِ تقریب
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                {programDateStr}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <span>{programDayEnglish}</span>
                {programDayUrdu && (
                  <span
                    style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                  >
                    ({programDayUrdu})
                  </span>
                )}
              </div>
            </div>

            {/* Program Type */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  PROGRAM TYPE
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  نوعیتِ تقریب
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {booking.programType || 'تقریب (Event)'}
              </div>
              <div className="text-[11px] text-slate-500">Reserved Event</div>
            </div>

            {/* Timings */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  TIMINGS
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  وقتِ تقریب
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {booking.timings || 'Evening (شام)'}
              </div>
              <div className="text-[11px] text-slate-500">As per schedule</div>
            </div>

            {/* Venue Location */}
            <div className="p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  VENUE ADDRESS
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  مقامِ تقریب
                </span>
              </div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-2 leading-snug">
                {booking.address || 'KMLWJ Welfare Complex, Nawalane, Lyari, Karachi'}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           4. VENUE ASSIGNMENT SHOWCASE MATRIX (SECTION 3)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded-md overflow-hidden mb-3 bg-white">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#334155' }}
          >
            <span>3. ASSIGNED VENUE VERIFICATION MATRIX</span>
            <span
              className="text-xs font-bold"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              منتخب کردہ ہال / تقریب کا مقام
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-300">
            {hallsList.map((hall) => {
              const selected = hall.selected;
              return (
                <div
                  key={hall.id}
                  className={`p-2.5 flex flex-col justify-between transition-all relative ${
                    selected ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                  }`}
                  style={
                    selected
                      ? {
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact'
                        }
                      : {
                          backgroundColor: '#ffffff',
                          color: '#334155'
                        }
                  }
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`text-xs sm:text-sm font-bold leading-snug ${
                        selected ? 'text-white' : 'text-slate-800'
                      }`}
                      style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                    >
                      {hall.urduName}
                    </span>
                    {selected ? (
                      <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" /> ASSIGNED
                      </span>
                    ) : (
                      <span className="shrink-0 w-3.5 h-3.5 rounded-xs border border-slate-300 inline-block" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider mt-1 block ${
                      selected ? 'text-amber-300' : 'text-slate-500'
                    }`}
                  >
                    {hall.englishName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           5. FINANCIAL ASSESSMENT & SETTLEMENT BOX (SECTION 4)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded-md overflow-hidden mb-3 bg-white">
          <div
            className="px-3 py-1 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#334155' }}
          >
            <span>4. PAYMENT SETTLEMENT & AMOUNT VERIFICATION</span>
            <span
              className="text-xs font-bold"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              تفصیلاتِ ادائیگی و رقم حرفی
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
            {/* Amount in Words */}
            <div className="p-3 sm:col-span-2 bg-slate-50/70 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                AMOUNT RECEIVED IN WORDS / رقم حرفی
              </span>
              <p className="text-xs sm:text-sm font-bold italic text-slate-900 mt-1 capitalize border-l-2 border-slate-800 pl-2.5 leading-relaxed">
                "{amountWords}"
              </p>
            </div>

            {/* Total Paid Currency Card */}
            <div
              className="p-3 flex flex-col justify-center items-end text-right"
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact'
              }}
            >
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block">
                TOTAL BOOKING CHARGES / کل رقم
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5 tracking-tight">
                Rs. {Number(booking.amount || 0).toLocaleString()}/-
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 mt-0.5">
                <CheckCircle2 className="h-3 w-3" /> SETTLED & VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           6. FOUR EXECUTIVE SIGNATURE BLOCKS & SEAL (SECTION 5)
           ══════════════════════════════════════════════════════════ */}
        <div
          className={`relative z-10 grid grid-cols-4 items-end gap-3 text-center ${
            isCompact ? 'pt-4 pb-1 mt-1' : 'pt-7 sm:pt-8 pb-1 mt-3'
          }`}
        >
          {/* Sign 1 */}
          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-28 border-b-2 border-slate-800 pb-1 mb-1" />
            <span
              className="text-xs font-bold text-slate-900 block"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              بکنگ کلرک
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              Booking Clerk
            </span>
          </div>

          {/* Sign 2 */}
          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-28 border-b-2 border-slate-800 pb-1 mb-1" />
            <span
              className="text-xs font-bold text-slate-900 block"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              وصول کنندہ
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              Received By
            </span>
          </div>

          {/* Sign 3 */}
          <div className="flex flex-col items-center">
            <div className="w-20 sm:w-28 border-b-2 border-slate-800 pb-1 mb-1" />
            <span
              className="text-xs font-bold text-slate-900 block"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              رعایت کی منظوری
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              Discount Approval
            </span>
          </div>

          {/* Sign 4 */}
          <div className="flex flex-col items-center relative">
            {/* Stamp Circle Watermark */}
            <div className="absolute -top-6 w-14 h-14 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center opacity-35 pointer-events-none">
              <span className="text-[8px] font-bold uppercase text-slate-400 rotate-[-12deg]">
                OFFICIAL SEAL
              </span>
            </div>
            <div className="w-20 sm:w-28 border-b-2 border-slate-800 pb-1 mb-1 relative z-10" />
            <span
              className="text-xs font-bold text-slate-900 block"
              style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
            >
              جنرل سیکریٹری
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              General Secretary
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           7. FOOTER TERMS & GUIDELINES
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 mt-3 pt-2 border-t border-slate-300 text-center">
          <p
            className="text-[11px] sm:text-xs font-bold text-slate-700 leading-snug"
            style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
          >
            ہدایات: تقریب کے وقت اصل رسید دکھانا اور مقررہ اوقات و جماعت کے تمام قواعد و ضوابط کی پابندی لازمی ہے۔ خلاف ورزی کی صورت میں جماعت کو بکنگ منسوخ کرنے کا اختیار ہوگا۔
          </p>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
            Note: Original booking receipt must be presented at the venue. Strict adherence to KMLWJ rules and scheduled event timings is mandatory.
          </p>
        </div>
      </div>
    </div>
  );
};

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  const { t } = useTranslation();
  // 'both-full' | 'both-compact' | 'customer' | 'office'
  const [printMode, setPrintMode] = useState('both-full');

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!booking) return null;

  const isCompact = printMode === 'both-compact';

  return createPortal(
    <div
      id="print-receipt-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none print:static print:inset-auto print:block"
    >
      <div className="w-full max-w-5xl bg-slate-100 rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden print:overflow-visible border border-slate-700/50 print:border-none print:static print:block print:w-full print:bg-white">
        {/* ══════════════════════════════════════════════════════════
           TOP EXECUTIVE ACTION BAR (HIDDEN IN PRINT)
           ══════════════════════════════════════════════════════════ */}
        <div className="print-hide-bar flex flex-col sm:flex-row justify-between items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Official Hall Booking Certificate & Receipt
              </h2>
              <p className="text-xs text-slate-300">
                KMLWJ Verified Professional Voucher System
              </p>
            </div>
          </div>

          {/* Copy & Layout Selector Tabs */}
          <div className="flex flex-wrap items-center bg-slate-950/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPrintMode('both-full')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both-full'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5 inline mr-1.5" />
              2-Page Full Certificate
            </button>
            <button
              onClick={() => setPrintMode('both-compact')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both-compact'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Copy className="h-3.5 w-3.5 inline mr-1.5" />
              2-in-1 Compact Sheet
            </button>
            <button
              onClick={() => setPrintMode('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'customer'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Customer Copy
            </button>
            <button
              onClick={() => setPrintMode('office')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'office'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Office Copy
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Preview (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           RECEIPT PREVIEW SCROLLABLE CONTAINER
           ══════════════════════════════════════════════════════════ */}
        <div className="overflow-y-auto print:overflow-visible bg-slate-200/80 print:bg-white flex flex-col items-center p-4 sm:p-6 print:p-0 print:static print:block">
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

          <div
            id="print-receipt-wrapper"
            className="w-full max-w-[820px] print:max-w-full flex flex-col items-center"
          >
            {/* Customer Copy */}
            {(printMode === 'both-full' ||
              printMode === 'both-compact' ||
              printMode === 'customer') && (
              <div
                className={`w-full ${
                  printMode === 'both-full' ? 'receipt-page-break' : ''
                }`}
              >
                <ReceiptPage
                  key="customer-copy"
                  booking={booking}
                  copyType="customer"
                  copyUrduTitle="صارف کاپی (Customer Copy)"
                  copyEnglishTitle="CUSTOMER COPY"
                  isCompact={isCompact}
                />
              </div>
            )}

            {/* Scissor Cut Line Separator for Compact 2-in-1 mode */}
            {printMode === 'both-compact' && (
              <div className="w-full my-2 print:my-1.5 flex items-center gap-3 text-slate-500 select-none px-4">
                <div className="flex-1 border-b-2 border-dashed border-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span>✂</span> CUT HERE / یہاں سے علیحدہ کریں <span>✂</span>
                </span>
                <div className="flex-1 border-b-2 border-dashed border-slate-400" />
              </div>
            )}

            {/* Office Copy */}
            {(printMode === 'both-full' ||
              printMode === 'both-compact' ||
              printMode === 'office') && (
              <div className="w-full">
                <ReceiptPage
                  key="office-copy"
                  booking={booking}
                  copyType="office"
                  copyUrduTitle="دفتری کاپی (Office Record Copy)"
                  copyEnglishTitle="OFFICE RECORD COPY"
                  isCompact={isCompact}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
