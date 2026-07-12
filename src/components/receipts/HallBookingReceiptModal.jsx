import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Copy,
  Check,
  Award,
  CheckCircle2
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

const ReceiptPage = ({ booking, copyType, copyUrduTitle, copyEnglishTitle }) => {
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
      className="w-full max-w-[800px] print:max-w-full bg-white text-slate-900 mx-auto box-border p-2 sm:p-3 print:p-1.5"
      style={{
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Outer Executive Light/Emerald Frame */}
      <div
        className="relative bg-white border-2 border-emerald-800/80 print:border-slate-800 rounded-lg shadow-xs print:shadow-none overflow-hidden p-2.5 sm:p-3 print:p-2"
        style={{ borderColor: '#065f46' }}
      >
        {/* Subtle Watermark Emblem */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none z-0">
          <img src={logoImg} alt="Watermark" className="w-[240px] h-[240px] object-contain" />
        </div>

        {/* ══════════════════════════════════════════════════════════
           1. TOP VOUCHER BAR & INSTITUTION HEADER (ALL LIGHT / HIGH CONTRAST)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border-b-2 border-emerald-800/60 pb-2 mb-2 print:pb-1.5 print:mb-1.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Left Block: Logo + Bilingual Organization Name */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center p-1 border border-emerald-700/30 rounded-lg bg-emerald-50/50">
              <img src={logoImg} alt="KMLWJ Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none"
                  style={{
                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                    color: '#0f172a'
                  }}
                >
                  کچھی مسلم لوھارواڑھا ویلفیئر جماعت
                </h1>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: '#ecfdf5',
                    borderColor: '#10b981',
                    color: '#065f46'
                  }}
                >
                  REG # 1319
                </span>
              </div>
              <h2
                className="text-xs sm:text-sm font-black tracking-wide uppercase mt-0.5"
                style={{ color: '#065f46' }}
              >
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAAT (REGD.)
              </h2>
              <p className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">
                Juma Baloch Road, Near K.E. Grid Station, Nawalane, Lyari, Karachi
              </p>
            </div>
          </div>

          {/* Right Block: Classification Badge & Voucher Number */}
          <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-1.5 shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200">
            {/* Copy Badge (Light High-Contrast Theme - Never Black!) */}
            <div
              className="px-3 py-1 rounded border-2 text-right"
              style={{
                backgroundColor: isCustomer ? '#ecfdf5' : '#fffbeb',
                borderColor: isCustomer ? '#059669' : '#d97706',
                color: isCustomer ? '#064e3b' : '#78350f'
              }}
            >
              <span className="text-[8px] uppercase tracking-widest font-bold block opacity-80">
                COPY CLASSIFICATION
              </span>
              <span className="text-xs sm:text-sm font-black tracking-wide block">
                {copyEnglishTitle}
              </span>
              <span
                className="text-xs font-bold block"
                style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
              >
                {copyUrduTitle}
              </span>
            </div>

            {/* Receipt No & Issue Date Box */}
            <div
              className="flex items-center gap-2.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-0.5 text-right"
              style={{ color: '#0f172a' }}
            >
              <div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">
                  RECEIPT NO
                </span>
                <span
                  className="text-xs sm:text-sm font-black font-mono block"
                  style={{ color: '#0f172a' }}
                >
                  #{String(booking.receiptNo || '0001').padStart(4, '0')}
                </span>
              </div>
              <div className="h-5 w-px bg-slate-300" />
              <div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">
                  ISSUE DATE
                </span>
                <span
                  className="text-xs font-bold block"
                  style={{ color: '#0f172a' }}
                >
                  {bookingDateStr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Title Bar (Crisp Light Emerald & Amber Theme) */}
        <div
          className="relative z-10 px-3 py-1 rounded border mb-2 flex items-center justify-between"
          style={{
            backgroundColor: '#f0fdf4',
            borderColor: '#6ee7b7',
            color: '#064e3b'
          }}
        >
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-emerald-700 shrink-0" />
            <span
              className="text-xs sm:text-sm font-black uppercase tracking-wider"
              style={{ color: '#064e3b' }}
            >
              OFFICIAL HALL BOOKING RECEIPT & RESERVATION VOUCHER
            </span>
          </div>
          <span
            className="text-xs sm:text-sm font-bold"
            style={{
              fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              color: '#064e3b'
            }}
          >
            باضابطہ رسید و تصدیق نامہ بکنگ ہال
          </span>
        </div>

        {/* ══════════════════════════════════════════════════════════
           2. BOOKER & MEMBERSHIP INFORMATION TABLE (SECTION 1)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-2 bg-white">
          <div
            className="px-2.5 py-0.5 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
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
            <div className="p-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  BOOKER NAME
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  نام بکنگ کنندہ
                </span>
              </div>
              <div
                className="text-sm font-black mt-0.5 truncate"
                style={{ color: '#0f172a' }}
              >
                {booking.bookerName || '—'}
              </div>
            </div>

            {/* Contact Phone */}
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  CONTACT NO.
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  رابطہ نمبر
                </span>
              </div>
              <div
                className="text-xs sm:text-sm font-black mt-0.5 font-mono"
                style={{ color: '#0f172a' }}
                dir="ltr"
              >
                {booking.mobile || '—'}
              </div>
            </div>

            {/* Community Membership */}
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
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
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: '#ecfdf5',
                      borderColor: '#10b981',
                      color: '#065f46'
                    }}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                    جماعت ممبر (Member)
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: '#f1f5f9',
                      borderColor: '#cbd5e1',
                      color: '#334155'
                    }}
                  >
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
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-2 bg-white">
          <div
            className="px-2.5 py-0.5 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
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
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  EVENT DATE
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  تاریخِ تقریب
                </span>
              </div>
              <div
                className="text-sm font-black mt-0.5"
                style={{ color: '#0f172a' }}
              >
                {programDateStr}
              </div>
              <div className="text-[10px] font-semibold text-slate-600 flex items-center gap-1">
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
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  PROGRAM TYPE
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  نوعیتِ تقریب
                </span>
              </div>
              <div
                className="text-sm font-black mt-0.5"
                style={{ color: '#0f172a' }}
              >
                {booking.programType || 'تقریب (Event)'}
              </div>
            </div>

            {/* Timings */}
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  TIMINGS
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  وقتِ تقریب
                </span>
              </div>
              <div
                className="text-sm font-black mt-0.5"
                style={{ color: '#0f172a' }}
              >
                {booking.timings || 'Evening (شام)'}
              </div>
            </div>

            {/* Venue Location */}
            <div className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  VENUE ADDRESS
                </span>
                <span
                  className="text-xs font-bold text-slate-600"
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                >
                  مقامِ تقریب
                </span>
              </div>
              <div
                className="text-xs font-bold mt-0.5 leading-snug truncate"
                style={{ color: '#0f172a' }}
              >
                {booking.address || 'KMLWJ Complex, Lyari, Karachi'}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           4. VENUE ASSIGNMENT SHOWCASE MATRIX (SECTION 3)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-2 bg-white">
          <div
            className="px-2.5 py-0.5 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
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
                  className="p-2 flex flex-col justify-between transition-all relative"
                  style={
                    selected
                      ? {
                          backgroundColor: '#ecfdf5',
                          border: '2px solid #059669',
                          color: '#064e3b'
                        }
                      : {
                          backgroundColor: '#ffffff',
                          color: '#475569'
                        }
                  }
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className="text-xs sm:text-sm font-bold leading-snug"
                      style={{
                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        color: selected ? '#064e3b' : '#334155'
                      }}
                    >
                      {hall.urduName}
                    </span>
                    {selected ? (
                      <span
                        className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border"
                        style={{
                          backgroundColor: '#10b981',
                          borderColor: '#059669',
                          color: '#ffffff'
                        }}
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3]" /> ASSIGNED
                      </span>
                    ) : (
                      <span className="shrink-0 w-3.5 h-3.5 rounded-xs border border-slate-300 inline-block" />
                    )}
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider mt-0.5 block"
                    style={{ color: selected ? '#065f46' : '#64748b' }}
                  >
                    {hall.englishName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           5. FINANCIAL ASSESSMENT & SETTLEMENT BOX (SECTION 4 - LIGHT / HIGH CONTRAST)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 border border-slate-300 rounded overflow-hidden mb-2 bg-white">
          <div
            className="px-2.5 py-0.5 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
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
            <div className="p-2 sm:col-span-2 bg-slate-50 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                AMOUNT RECEIVED IN WORDS / رقم حرفی
              </span>
              <p
                className="text-xs sm:text-sm font-bold italic mt-0.5 capitalize border-l-2 border-emerald-600 pl-2 leading-relaxed"
                style={{ color: '#0f172a' }}
              >
                "{amountWords}"
              </p>
            </div>

            {/* Total Paid Currency Card (Light Executive Green Box - Always Readable in Print) */}
            <div
              className="p-2 flex flex-col justify-center items-end text-right"
              style={{
                backgroundColor: '#ecfdf5',
                borderLeft: '2px solid #10b981',
                color: '#064e3b'
              }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-widest block"
                style={{ color: '#065f46' }}
              >
                TOTAL SETTLED AMOUNT / کل رقم
              </span>
              <div
                className="text-lg sm:text-xl font-black font-mono mt-0.5 tracking-tight"
                style={{ color: '#064e3b' }}
              >
                Rs. {Number(booking.amount || 0).toLocaleString()}/-
              </div>
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mt-0.5"
                style={{ color: '#059669' }}
              >
                <CheckCircle2 className="h-3 w-3" /> SETTLED & VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           6. FOUR EXECUTIVE SIGNATURE BLOCKS & SEAL (SECTION 5)
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 grid grid-cols-4 items-end gap-2 text-center pt-4 pb-0.5 mt-1">
          {/* Sign 1 */}
          <div className="flex flex-col items-center">
            <div className="w-16 sm:w-24 border-b-2 border-slate-700 pb-0.5 mb-1" />
            <span
              className="text-xs font-bold block"
              style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              بکنگ کلرک
            </span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              Booking Clerk
            </span>
          </div>

          {/* Sign 2 */}
          <div className="flex flex-col items-center">
            <div className="w-16 sm:w-24 border-b-2 border-slate-700 pb-0.5 mb-1" />
            <span
              className="text-xs font-bold block"
              style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              وصول کنندہ
            </span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              Received By
            </span>
          </div>

          {/* Sign 3 */}
          <div className="flex flex-col items-center">
            <div className="w-16 sm:w-24 border-b-2 border-slate-700 pb-0.5 mb-1" />
            <span
              className="text-xs font-bold block"
              style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              رعایت کی منظوری
            </span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              Discount Approval
            </span>
          </div>

          {/* Sign 4 */}
          <div className="flex flex-col items-center relative">
            {/* Stamp Circle Watermark */}
            <div className="absolute -top-5 w-11 h-11 border-2 border-dashed border-emerald-600 rounded-full flex items-center justify-center opacity-30 pointer-events-none">
              <span className="text-[6px] font-bold uppercase text-emerald-800 rotate-[-12deg]">
                OFFICIAL SEAL
              </span>
            </div>
            <div className="w-16 sm:w-24 border-b-2 border-slate-700 pb-0.5 mb-1 relative z-10" />
            <span
              className="text-xs font-bold block"
              style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                color: '#0f172a'
              }}
            >
              جنرل سیکریٹری
            </span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              General Secretary
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           7. FOOTER TERMS & GUIDELINES
           ══════════════════════════════════════════════════════════ */}
        <div className="relative z-10 mt-1.5 pt-1 border-t border-slate-200 text-center">
          <p
            className="text-[10px] sm:text-[11px] font-bold leading-tight"
            style={{
              fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              color: '#334155'
            }}
          >
            ہدایات: تقریب کے وقت اصل رسید دکھانا اور مقررہ اوقات و جماعت کے تمام قواعد و ضوابط کی پابندی لازمی ہے۔
          </p>
        </div>
      </div>
    </div>
  );
};

export const HallBookingReceiptModal = ({ booking, onClose }) => {
  const { t } = useTranslation();
  // Default to 'both-1page' so both Customer Copy & Office Copy print on ONE single sheet of A4 paper!
  const [printMode, setPrintMode] = useState('both-1page');

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

  return createPortal(
    <div
      id="print-receipt-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none print:static print:inset-auto print:block"
    >
      <div className="w-full max-w-5xl bg-slate-100 rounded-2xl shadow-2xl flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none overflow-hidden print:overflow-visible border border-slate-700/50 print:border-none print:static print:block print:w-full print:bg-white">
        {/* ══════════════════════════════════════════════════════════
           TOP EXECUTIVE ACTION BAR (HIDDEN IN PRINT)
           ══════════════════════════════════════════════════════════ */}
        <div className="print-hide-bar flex flex-col sm:flex-row justify-between items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Official Hall Booking Voucher (Print Preview)
              </h2>
              <p className="text-xs text-emerald-300">
                Light Theme — Optimized for 100% Print Visibility on A4 Paper
              </p>
            </div>
          </div>

          {/* Copy & Layout Selector Tabs */}
          <div className="flex flex-wrap items-center bg-slate-950/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setPrintMode('both-1page')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'both-1page'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Copy className="h-3.5 w-3.5 inline mr-1.5" />
              Both Copies (1 Page — Top & Bottom)
            </button>
            <button
              onClick={() => setPrintMode('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'customer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Customer Copy Only
            </button>
            <button
              onClick={() => setPrintMode('office')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                printMode === 'office'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Office Copy Only
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Preview (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
           RECEIPT PREVIEW CONTAINER (OPTIMIZED FOR 1-PAGE A4 PRINTING)
           ══════════════════════════════════════════════════════════ */}
        <div className="overflow-y-auto print:overflow-visible bg-slate-200/80 print:bg-white flex flex-col items-center p-3 sm:p-5 print:p-0 print:static print:block">
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
              @page {
                size: A4 portrait;
                margin: 5mm;
              }
            }
          `}</style>

          <div
            id="print-receipt-wrapper"
            className="w-full max-w-[800px] print:max-w-full flex flex-col items-center"
          >
            {/* Customer Copy */}
            {(printMode === 'both-1page' || printMode === 'customer') && (
              <div className="w-full">
                <ReceiptPage
                  key="customer-copy"
                  booking={booking}
                  copyType="customer"
                  copyUrduTitle="صارف کاپی (Customer Copy)"
                  copyEnglishTitle="CUSTOMER COPY"
                />
              </div>
            )}

            {/* Scissor Cut Line Separator (Fits between both copies on a single A4 page) */}
            {printMode === 'both-1page' && (
              <div className="w-full my-1.5 print:my-1 flex items-center gap-2 text-slate-500 select-none px-4">
                <div className="flex-1 border-b-2 border-dashed border-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <span>✂</span> CUT HERE / یہاں سے علیحدہ کریں <span>✂</span>
                </span>
                <div className="flex-1 border-b-2 border-dashed border-slate-400" />
              </div>
            )}

            {/* Office Copy */}
            {(printMode === 'both-1page' || printMode === 'office') && (
              <div className="w-full">
                <ReceiptPage
                  key="office-copy"
                  booking={booking}
                  copyType="office"
                  copyUrduTitle="دفتری کاپی (Office Record Copy)"
                  copyEnglishTitle="OFFICE RECORD COPY"
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
