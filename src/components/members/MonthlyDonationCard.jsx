import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_NAME_EN = 'KUTCHI MUSLIM LOHARWADA WELFARE JAMAT';
const ORG_NAME_UR = 'کچھی مسلم لوہارواڈھا ویلفیئر جماعت';
const ORG_RETURN_EN = 'Jamat Khana, Loharwada, Lyari, Karachi - Pakistan';
const ORG_RETURN_UR = 'جماعت خانہ، لوہارواڈھا، لیاری، کراچی';
const ORG_PHONE = '021-32524455';
const ORG_WEBSITE = 'www.kmlwj.org';

function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
function fmtAmount(val) {
  if (!val && val !== 0) return '—';
  return `Rs ${Number(val).toLocaleString('en-PK')}`;
}

function CardShell({ children }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #EAEFF2 0%, #F8FAFC 50%, #DFE5EA 100%)',
      border: '1.5px solid #0D4E2B',
      borderRadius: 'inherit',
      boxSizing: 'border-box',
      fontFamily: "'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Watermark Logo */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.12, pointerEvents: 'none',
      }}>
        <img src={logoSrc} alt="" style={{ width: '65%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT CARD ─────────────────────────────────── */
export function MonthlyDonationCardFront({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const donor = card?.donor || null;

  const displayName = (card?.name || beneficiary?.name || member?.fullName || donor?.fullName || 'RECIPIENT NAME').toUpperCase();
  const fatherName = card?.fatherName || beneficiary?.fatherName || beneficiary?.husbandName || member?.fatherName || donor?.fatherName || '—';
  const cardNo = card?.cardNumber || 'MD-2026-001';
  const issueDate = fmtDate(card?.issueDate || card?.createdAt || new Date());
  const amount = card?.amount || card?.monthlyAmount || 5000;
  const cnic = card?.cnic || beneficiary?.cnic || member?.cnic || donor?.cnic || '—';
  const photoUrl = card?.photoUrl || beneficiary?.photoUrl || member?.photoUrl;

  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = card?.cardNumber
    ? `${VERIFY_BASE}/verify/monthly-donation/${encodeURIComponent(card.cardNumber)}`
    : `${VERIFY_BASE}/verify/monthly-donation`;

  return (
    <CardShell>
      {/* ── TOP RIGHT & RIGHT SIDE EMERALD GREEN & GOLD DECORATIVE WAVE ── */}
      <svg style={{
        position: 'absolute', top: 0, right: 0,
        width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
      }} viewBox="0 0 340 215" preserveAspectRatio="none">
        <defs>
          <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D4E2B" />
            <stop offset="50%" stopColor="#08381E" />
            <stop offset="100%" stopColor="#041E10" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D77F" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#AA7C11" />
          </linearGradient>
        </defs>

        {/* Top-Right Decorative Corner Shield */}
        <path d="M 230 0 L 340 0 L 340 65 Q 280 40 230 0 Z" fill="url(#emeraldGrad)" />
        <path d="M 228 0 Q 280 42 340 67" fill="none" stroke="url(#goldGrad)" strokeWidth="2.5" />

        {/* Main Right Side Wave Container for Photo Frame */}
        <path d="M 340 35 C 255 75 240 120 260 175 C 270 195 300 205 340 205 Z" fill="url(#emeraldGrad)" />
        <path d="M 340 35 C 255 75 240 120 260 175 C 270 195 300 205 340 205" fill="none" stroke="url(#goldGrad)" strokeWidth="2.5" />
      </svg>

      {/* ── CARD BODY ── */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── TOP HEADER SECTION ── */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '6px 10px 0 10px' }}>
          {/* Mosque Logo Icon */}
          <div style={{
            width: '46px', height: '46px', flexShrink: 0, marginRight: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={logoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {/* Titles & Tagline (Urdu & English) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Urdu Header */}
            <div style={{
              fontSize: '11px', fontWeight: 900, color: '#0D4E2B',
              lineHeight: 1.1, textAlign: 'left', direction: 'rtl',
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Segoe UI', Tahoma, sans-serif",
            }}>
              {ORG_NAME_UR}
            </div>
            {/* English Header */}
            <div style={{
              fontSize: '8px', fontWeight: 800, color: '#1B2A1E',
              letterSpacing: '0.04em', lineHeight: 1.1, textTransform: 'uppercase', marginTop: '1px',
            }}>
              {ORG_NAME_EN}
            </div>

            {/* Diamond Separator Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #D4AF37 0%, transparent 100%)' }} />
              <div style={{ width: '3px', height: '3px', transform: 'rotate(45deg)', background: '#D4AF37' }} />
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #D4AF37 100%)' }} />
            </div>

            {/* Card Subtitle Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                fontSize: '9.5px', fontWeight: 900, color: '#0D4E2B',
                letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.1,
              }}>
                MONTHLY DONATION CARD
              </div>
              <div style={{
                fontSize: '9.5px', fontWeight: 900, color: '#D4AF37',
                lineHeight: 1.1,
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', sans-serif",
              }}>
                (ماہانہ عطیہ کارڈ)
              </div>
            </div>
          </div>

          <div style={{ width: '36px', height: '16px', zIndex: 3 }} />
        </div>

        {/* ── CENTER SECTION: LEFT DETAILS & RIGHT PHOTO FRAME ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '5px 10px 0 10px', alignItems: 'center' }}>

          {/* Left Details List with Round Emerald Badges and Dual Language Labels */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', pr: '4px' }}>

            {/* Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#0D4E2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800, width: '68px', flexShrink: 0 }}>
                نام / Name
              </span>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800 }}>:</span>
              <span style={{ fontSize: '9px', color: '#111111', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </span>
            </div>

            {/* Card No */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#0D4E2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="6" y1="9" x2="10" y2="9" />
                  <line x1="6" y1="13" x2="14" y2="13" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800, width: '68px', flexShrink: 0 }}>
                کارڈ نمبر / No.
              </span>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800 }}>:</span>
              <span style={{ fontSize: '9px', color: '#0D4E2B', fontWeight: 900, fontFamily: 'monospace' }}>
                {cardNo}
              </span>
            </div>

            {/* S/O / Husband Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#0D4E2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800, width: '68px', flexShrink: 0 }}>
                ولدیت / Father
              </span>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800 }}>:</span>
              <span style={{ fontSize: '8.5px', color: '#222222', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fatherName}
              </span>
            </div>

            {/* CNIC */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#0D4E2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800, width: '68px', flexShrink: 0 }}>
                شناختی کارڈ / CNIC
              </span>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800 }}>:</span>
              <span style={{ fontSize: '8.5px', color: '#222222', fontWeight: 800 }}>
                {cnic}
              </span>
            </div>

            {/* Monthly Amount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#D4AF37',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#0D4E2B', fontWeight: 900, width: '68px', flexShrink: 0 }}>
                ماہانہ / Monthly
              </span>
              <span style={{ fontSize: '8px', color: '#0D4E2B', fontWeight: 900 }}>:</span>
              <span style={{ fontSize: '9.5px', color: '#0D4E2B', fontWeight: 900 }}>
                {fmtAmount(amount)}
              </span>
            </div>

            {/* Issue Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '15px', height: '15px', borderRadius: '50%', background: '#0D4E2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800, width: '68px', flexShrink: 0 }}>
                تاریخ / Date
              </span>
              <span style={{ fontSize: '8px', color: '#444444', fontWeight: 800 }}>:</span>
              <span style={{ fontSize: '8.5px', color: '#222222', fontWeight: 800 }}>
                {issueDate}
              </span>
            </div>
          </div>

          {/* Right Side Photo Box embedded over emerald curve */}
          <div style={{
            position: 'relative', zIndex: 10,
            width: '66px', height: '94px',
            aspectRatio: '1 / 1.42',
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '2.5px solid #D4AF37',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            marginLeft: '6px',
            flexShrink: 0,
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888888', textAlign: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D4E2B" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span style={{ fontSize: '7.5px', color: '#0D4E2B', fontWeight: 800, marginTop: '2px' }}>تصویر / Photo</span>
              </div>
            )}
          </div>
        </div>

        {/* ── LOWER SECTION: LEFT QR CODE & SLOGAN ── */}
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', padding: '2px 10px 3px 10px',
        }}>
          {/* Bottom Left Small QR Code */}
          <div style={{
            background: '#FFFFFF', padding: '2px', borderRadius: '4px',
            border: '1.5px solid #D4AF37', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <QRCodeSVG value={qrValue} size={128} style={{ width: '100%', height: '100%' }} />
          </div>

          <div style={{
            fontSize: '8px', fontWeight: 900, color: '#0D4E2B',
            fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', sans-serif",
            direction: 'rtl', textAlign: 'right', paddingBottom: '2px',
          }}>
            خدمتِ خلق ہمارا نصب العین ہے
          </div>
        </div>

        {/* ── BOTTOM FULL-WIDTH SLOGAN STRIP ── */}
        <div style={{
          background: 'linear-gradient(90deg, #0D4E2B 0%, #08381E 100%)',
          padding: '3px 0', textAlign: 'center',
          borderTop: '1px solid #D4AF37', marginTop: 'auto',
        }}>
          <span style={{ fontSize: '7.5px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            &mdash; TOGETHER WE GROW, TOGETHER WE SERVE &mdash;
          </span>
        </div>

      </div>
    </CardShell>
  );
}

/* ─────────────────────────────────── BACK CARD ─────────────────────────────────── */
export function MonthlyDonationCardBack({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const donor = card?.donor || null;

  const address = card?.address || beneficiary?.address || member?.address || donor?.address || 'Lyari, Karachi';
  const mobile = card?.mobile || beneficiary?.mobile || member?.mobile || donor?.mobile || '0300-XXXXXXX';
  const gham = card?.gham || beneficiary?.gham || member?.ghamName || '—';

  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = card?.cardNumber
    ? `${VERIFY_BASE}/verify/monthly-donation/${encodeURIComponent(card.cardNumber)}`
    : `${VERIFY_BASE}/verify/monthly-donation`;

  return (
    <CardShell>
      {/* ── LEFT EMERALD GREEN SIDEBAR CURVE ── */}
      <svg style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
      }} viewBox="0 0 340 215" preserveAspectRatio="none">
        <defs>
          <linearGradient id="backEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D4E2B" />
            <stop offset="50%" stopColor="#08381E" />
            <stop offset="100%" stopColor="#041E10" />
          </linearGradient>
        </defs>

        {/* Left Side Curved Panel */}
        <path d="M 0 0 L 115 0 C 95 65 95 135 115 190 L 0 190 Z" fill="url(#backEmeraldGrad)" />
        <path d="M 115 0 C 95 65 95 135 115 190" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
      </svg>

      {/* ── CARD BODY ── */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── MAIN CONTENT GRID ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '6px 10px 4px 10px' }}>

          {/* Left Emerald Section: Logo & Jamaat Title in Urdu & English */}
          <div style={{
            width: '90px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            paddingRight: '6px', paddingLeft: '4px', boxSizing: 'border-box',
          }}>
            <img src={logoSrc} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', filter: 'brightness(1.2)' }} />
            <div style={{
              fontSize: '8px', fontWeight: 900, color: '#FFFFFF',
              lineHeight: 1.15, marginTop: '4px',
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', sans-serif",
              direction: 'rtl',
            }}>
              کچھی مسلم لوہارواڈھا
            </div>
            <div style={{
              fontSize: '6.5px', fontWeight: 800, color: '#F5D77F',
              letterSpacing: '0.02em', lineHeight: 1.1, textTransform: 'uppercase', marginTop: '1px',
            }}>
              KMLW JAMAT
            </div>
            <div style={{ fontSize: '6px', color: '#D4AF37', marginTop: '2px' }}>
              &#9670;&#9644;&#9670;
            </div>
          </div>

          {/* Center & Right Sections: Rules in Urdu + Verification QR Code */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: '8px', minWidth: 0 }}>

            {/* Header: Notice */}
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{
                fontSize: '8.5px', fontWeight: 900, color: '#0D4E2B',
                letterSpacing: '0.02em', textTransform: 'uppercase',
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', sans-serif",
                direction: 'rtl',
              }}>
                ضروری ہدایات و معلومات (TERMS & CONDITIONS)
              </div>
              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '2px auto 0', width: '80%' }}>
                <div style={{ flex: 1, height: '1px', background: '#D4AF37' }} />
                <div style={{ width: '3px', height: '3px', transform: 'rotate(45deg)', background: '#D4AF37' }} />
                <div style={{ flex: 1, height: '1px', background: '#D4AF37' }} />
              </div>
            </div>

            {/* Rules & Large QR Side by Side */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>

              {/* 3 Terms Rules in Urdu & English */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4.5px' }}>

                {/* Rule 1 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#0D4E2B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <span style={{ fontSize: '7px', color: '#FFFFFF', fontWeight: 900 }}>۱</span>
                  </div>
                  <span style={{
                    fontSize: '7px', color: '#222222', fontWeight: 800, lineHeight: 1.25,
                    fontFamily: "'Noto Nastaliq Urdu', 'Segoe UI', sans-serif",
                  }}>
                    یہ کارڈ کچھی مسلم لوہارواڈھا ویلفیئر جماعت کی ملکیت ہے۔ (Property of KMLWJ)
                  </span>
                </div>

                {/* Rule 2 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#0D4E2B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <span style={{ fontSize: '7px', color: '#FFFFFF', fontWeight: 900 }}>۲</span>
                  </div>
                  <span style={{
                    fontSize: '7px', color: '#222222', fontWeight: 800, lineHeight: 1.25,
                    fontFamily: "'Noto Nastaliq Urdu', 'Segoe UI', sans-serif",
                  }}>
                    یہ کارڈ ناقابلِ انتقال ہے اور صرف نامزد فرد کے لیے ہے۔ (Non-transferable)
                  </span>
                </div>

                {/* Rule 3 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#0D4E2B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <span style={{ fontSize: '7px', color: '#FFFFFF', fontWeight: 900 }}>۳</span>
                  </div>
                  <span style={{
                    fontSize: '7px', color: '#222222', fontWeight: 800, lineHeight: 1.25,
                    fontFamily: "'Noto Nastaliq Urdu', 'Segoe UI', sans-serif",
                  }}>
                    گمشدگی کی صورت میں فوراً جماعت کے دفتر جمع کروائیں۔ (Return to Jamat office)
                  </span>
                </div>

                {/* Address & Contact summary */}
                <div style={{
                  fontSize: '6.5px', color: '#444444', fontWeight: 700, marginTop: '2px',
                  borderTop: '1px dashed #D4AF37', paddingTop: '2px',
                }}>
                  گام: <strong>{gham}</strong> • فون: <strong>{mobile}</strong>
                </div>

              </div>

              {/* Verification QR Box */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0,
              }}>
                <div style={{
                  background: '#FFFFFF', padding: '3px', borderRadius: '6px',
                  width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '1.5px solid #D4AF37',
                }}>
                  <QRCodeSVG value={qrValue} size={128} style={{ width: '100%', height: '100%' }} />
                </div>
                <span style={{ fontSize: '6px', color: '#0D4E2B', fontWeight: 900, letterSpacing: '0.04em' }}>
                  تصدیق / VERIFY
                </span>
              </div>

            </div>

          </div>

        </div>

        {/* ── BOTTOM FOOTER STRIP ── */}
        <div style={{
          background: 'linear-gradient(90deg, #0D4E2B 0%, #08381E 100%)',
          padding: '2.5px 6px',
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #D4AF37', marginTop: 'auto', gap: '4px',
        }}>
          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span style={{ fontSize: '6.5px', color: '#FFFFFF', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {ORG_RETURN_UR}
            </span>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span style={{ fontSize: '6.5px', color: '#F5D77F', fontWeight: 800, whiteSpace: 'nowrap' }}>
              📞 {ORG_PHONE}
            </span>
          </div>

          {/* Website */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span style={{ fontSize: '6.5px', color: '#FFFFFF', fontWeight: 800, whiteSpace: 'nowrap' }}>
              🌐 {ORG_WEBSITE}
            </span>
          </div>
        </div>

      </div>
    </CardShell>
  );
}

/* ────────────────────── Full Card preview (front + back) ────────────────────── */
export function MonthlyDonationCardPreview({ card }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <div className="membership-card-wrapper" style={{ width: '320px', height: '202px' }}>
        <MonthlyDonationCardFront card={card} />
      </div>
      <div className="membership-card-wrapper" style={{ width: '320px', height: '202px' }}>
        <MonthlyDonationCardBack card={card} />
      </div>
    </div>
  );
}

export default MonthlyDonationCardPreview;
