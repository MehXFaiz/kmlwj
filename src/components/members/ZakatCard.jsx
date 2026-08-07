import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM';
const ORG_LINE2    = 'LOHARWADA WELFARE JAMAT';
const ORG_RETURN   = 'Jamat Khana, Loharwada Karachi - Pakistan';
const ORG_PHONE    = '021-32524455';
const ORG_WEBSITE  = 'www.loharwadajamat.org';

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
      background: 'linear-gradient(135deg, #E6E8EA 0%, #F4F6F7 50%, #D8DCE0 100%)',
      border: '1px solid #C88A58',
      borderRadius: 'inherit',
      boxSizing: 'border-box',
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT CARD ─────────────────────────────────── */
export function ZakatCardFront({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const displayName = (beneficiary?.name || member?.fullName || 'BENEFICIARY NAME').toUpperCase();
  const cardNo = card?.cardNumber || member?.memberNo || 'KM LJ 25 0123';
  const issueDate = fmtDate(card?.issueDate || member?.doi || new Date());
  const extraInfo = card?.zakatAmount ? fmtAmount(card?.zakatAmount) : (member?.bloodGroup || member?.area || 'B+');
  const photoUrl = beneficiary?.photoUrl || member?.photoUrl;

  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = card?.cardNumber
    ? `${VERIFY_BASE}/verify/zakat/${encodeURIComponent(card.cardNumber)}`
    : member?.memberNo
    ? `${VERIFY_BASE}/verify/member/${encodeURIComponent(member.memberNo)}`
    : `${VERIFY_BASE}/verify/zakat`;

  return (
    <CardShell>
      {/* ── TOP RIGHT & RIGHT SIDE CHOCOLATE BROWN CURVED WAVE ── */}
      <svg style={{
        position: 'absolute', top: 0, right: 0,
        width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
      }} viewBox="0 0 340 215" preserveAspectRatio="none">
        <defs>
          <linearGradient id="brownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A2511" />
            <stop offset="50%" stopColor="#3B1D0D" />
            <stop offset="100%" stopColor="#251006" />
          </linearGradient>
          <linearGradient id="copperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D49B6A" />
            <stop offset="50%" stopColor="#C88A58" />
            <stop offset="100%" stopColor="#8C4F2B" />
          </linearGradient>
        </defs>

        {/* Top-Right Decorative Corner Shield */}
        <path d="M 230 0 L 340 0 L 340 65 Q 280 40 230 0 Z" fill="url(#brownGrad)" />
        <path d="M 228 0 Q 280 42 340 67" fill="none" stroke="url(#copperGrad)" strokeWidth="2.5" />

        {/* Main Right Side Wave Container for Photo & Signature */}
        <path d="M 340 35 C 255 75 240 120 260 175 C 270 195 300 205 340 205 Z" fill="url(#brownGrad)" />
        <path d="M 340 35 C 255 75 240 120 260 175 C 270 195 300 205 340 205" fill="none" stroke="url(#copperGrad)" strokeWidth="2.5" />
      </svg>

      {/* ── CARD BODY ── */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── TOP HEADER SECTION ── */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '7px 10px 0 10px' }}>
          {/* Mosque Logo Icon */}
          <div style={{
            width: '38px', height: '38px', flexShrink: 0, marginRight: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={logoSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {/* Titles & Tagline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '11px', fontWeight: 900, color: '#2A1408',
              letterSpacing: '0.02em', lineHeight: 1.1, textTransform: 'uppercase',
            }}>
              {ORG_LINE1} {ORG_LINE2}
            </div>
            {/* Diamond Separator Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #C88A58 0%, transparent 100%)' }} />
              <div style={{ width: '3px', height: '3px', transform: 'rotate(45deg)', background: '#C88A58' }} />
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #C88A58 100%)' }} />
            </div>
            {/* Card Subtitle */}
            <div style={{
              fontSize: '8.5px', fontWeight: 900, color: '#8C4F2B',
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              ZAKAT CARD
            </div>
          </div>

          {/* Top Right ZAKAT CARD Badge inside Brown Curve */}
          <div style={{
            textAlign: 'right', zIndex: 3, paddingRight: '6px', paddingTop: '3px',
          }}>
            <div style={{
              fontSize: '9.5px', fontWeight: 900, color: '#FFFFFF',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
            }}>
              ZAKAT CARD
            </div>
            {/* Small ornament under text */}
            <div style={{ fontSize: '5.5px', color: '#D49B6A', textAlign: 'center', marginTop: '1px' }}>
              &#9670;&#9644;&#9670;
            </div>
          </div>
        </div>

        {/* ── CENTER SECTION: LEFT DETAILS & RIGHT PHOTO FRAME ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '6px 10px 0 10px', alignItems: 'center' }}>

          {/* Left Details List with Round Icon Badges */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3.5px', pr: '4px' }}>

            {/* Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', background: '#3D1B0E',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, width: '56px', flexShrink: 0 }}>Name</span>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, margin: '0 2px' }}>:</span>
              <span style={{ fontSize: '9px', color: '#111111', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </span>
            </div>

            {/* Member ID / Card No */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', background: '#3D1B0E',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="6" y1="9" x2="10" y2="9" />
                  <line x1="6" y1="13" x2="14" y2="13" />
                </svg>
              </div>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, width: '56px', flexShrink: 0 }}>Card No</span>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, margin: '0 2px' }}>:</span>
              <span style={{ fontSize: '9px', color: '#111111', fontWeight: 900 }}>
                {cardNo}
              </span>
            </div>

            {/* Issue Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', background: '#3D1B0E',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, width: '56px', flexShrink: 0 }}>Issue Date</span>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, margin: '0 2px' }}>:</span>
              <span style={{ fontSize: '9px', color: '#111111', fontWeight: 900 }}>
                {issueDate}
              </span>
            </div>

            {/* Zakat Amount / Extra Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', background: '#3D1B0E',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, width: '56px', flexShrink: 0 }}>Amount</span>
              <span style={{ fontSize: '8.5px', color: '#555555', fontWeight: 700, margin: '0 2px' }}>:</span>
              <span style={{ fontSize: '9px', color: '#111111', fontWeight: 900 }}>
                {extraInfo}
              </span>
            </div>
          </div>

          {/* Right Side Photo Box embedded over brown curve */}
          <div style={{
            position: 'relative', zIndex: 10,
            width: '66px', height: '94px',
            aspectRatio: '1 / 1.42',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '2.5px solid #C88A58',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            marginLeft: '6px',
            flexShrink: 0,
          }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888888' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ── LOWER SECTION: LEFT QR CODE & RIGHT AUTHORIZED SIGNATURE ── */}
        <div style={{
          display: 'flex', flexDirection: 'row', alignItems: 'flex-end',
          justifyContent: 'space-between', padding: '2px 10px 4px 10px',
        }}>
          {/* Bottom Left Small QR Code */}
          <div style={{
            background: '#FFFFFF', padding: '2px', borderRadius: '4px',
            border: '1.5px solid #C88A58', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <QRCodeSVG value={qrValue} size={128} style={{ width: '100%', height: '100%' }} />
          </div>

        </div>

        {/* ── BOTTOM FULL-WIDTH SLOGAN STRIP ── */}
        <div style={{
          background: '#3B1D0D', padding: '3.5px 0', textAlign: 'center',
          borderTop: '1px solid #C88A58', marginTop: 'auto',
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
export function ZakatCardBack({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const address = beneficiary?.address || member?.address;
  const mobile = beneficiary?.mobile || member?.mobile;

  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = card?.cardNumber
    ? `${VERIFY_BASE}/verify/zakat/${encodeURIComponent(card.cardNumber)}`
    : member?.memberNo
    ? `${VERIFY_BASE}/verify/member/${encodeURIComponent(member.memberNo)}`
    : `${VERIFY_BASE}/verify/zakat`;

  return (
    <CardShell>
      {/* ── LEFT CHOCOLATE BROWN SIDEBAR CURVE ── */}
      <svg style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
      }} viewBox="0 0 340 215" preserveAspectRatio="none">
        <defs>
          <linearGradient id="backBrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A2511" />
            <stop offset="50%" stopColor="#3B1D0D" />
            <stop offset="100%" stopColor="#251006" />
          </linearGradient>
        </defs>

        {/* Left Side Curved Panel */}
        <path d="M 0 0 L 115 0 C 95 65 95 135 115 190 L 0 190 Z" fill="url(#backBrownGrad)" />
        <path d="M 115 0 C 95 65 95 135 115 190" fill="none" stroke="#C88A58" strokeWidth="2.5" />
      </svg>

      {/* ── CARD BODY ── */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── MAIN CONTENT GRID ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '8px 10px 4px 10px' }}>

          {/* Left Brown Section: Logo & Jamaat Title */}
          <div style={{
            width: '90px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            paddingRight: '6px', paddingLeft: '4px', boxSizing: 'border-box',
          }}>
            <img src={logoSrc} alt="Logo" style={{ width: '34px', height: '34px', objectFit: 'contain', filter: 'brightness(1.2)' }} />
            <div style={{
              fontSize: '7px', fontWeight: 900, color: '#FFFFFF',
              letterSpacing: '0.02em', lineHeight: 1.15, textTransform: 'uppercase', marginTop: '5px',
              maxWidth: '82px', wordBreak: 'break-word',
            }}>
              KUTCHI MUSLIM LOHARWADA WELFARE JAMAT
            </div>
            <div style={{ fontSize: '6px', color: '#D49B6A', marginTop: '3px' }}>
              &#9670;&#9644;&#9670;
            </div>
          </div>

          {/* Center & Right Sections: Rules + Large Verification QR Code */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: '8px', minWidth: 0 }}>

            {/* Header: Property Notice */}
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '7px', fontWeight: 700, color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                THIS CARD IS PROPERTY OF
              </div>
              <div style={{ fontSize: '9px', fontWeight: 900, color: '#2A1408', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '1px' }}>
                KUTCHI MUSLIM LOHARWADA WELFARE JAMAT
              </div>
              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '3px auto 0', width: '80%' }}>
                <div style={{ flex: 1, height: '1px', background: '#C88A58' }} />
                <div style={{ width: '3px', height: '3px', transform: 'rotate(45deg)', background: '#C88A58' }} />
                <div style={{ flex: 1, height: '1px', background: '#C88A58' }} />
              </div>
            </div>

            {/* Rules & Large QR Side by Side */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>

              {/* 3 Terms Rules with Circular Brown Icon Badges */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>

                {/* Rule 1 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{
                    width: '15px', height: '15px', borderRadius: '50%', background: '#3D1B0E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '7.5px', color: '#333333', fontWeight: 700, lineHeight: 1.25 }}>
                    This card is issued to the beneficiary of Kutchi Muslim Loharwada Welfare Jamat.
                  </span>
                </div>

                {/* Rule 2 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{
                    width: '15px', height: '15px', borderRadius: '50%', background: '#3D1B0E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="6" y1="9" x2="10" y2="9" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '7.5px', color: '#333333', fontWeight: 700, lineHeight: 1.25 }}>
                    This card is non-transferable. Please carry it with you at all times.
                  </span>
                </div>

                {/* Rule 3 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <div style={{
                    width: '15px', height: '15px', borderRadius: '50%', background: '#3D1B0E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '7.5px', color: '#333333', fontWeight: 700, lineHeight: 1.25 }}>
                    If found, please return to the Jamat Office.
                  </span>
                </div>

              </div>

              {/* Verification QR Box */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0,
              }}>
                <div style={{
                  background: '#FFFFFF', padding: '3px', borderRadius: '8px',
                  width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '1.5px solid #C88A58',
                }}>
                  <QRCodeSVG value={qrValue} size={128} style={{ width: '100%', height: '100%' }} />
                </div>
                <span style={{ fontSize: '6px', color: '#3D1B0E', fontWeight: 900, letterSpacing: '0.04em' }}>
                  VERIFY QR
                </span>
              </div>

            </div>

          </div>

        </div>

        {/* ── BOTTOM FOOTER STRIP ── */}
        <div style={{
          background: '#3B1D0D', padding: '3px 6px',
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #C88A58', marginTop: 'auto', gap: '4px',
        }}>
          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <svg width="8" height="8" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill="#C88A58"/>
            </svg>
            <span style={{ fontSize: '6.5px', color: '#FFFFFF', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {ORG_RETURN}
            </span>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#C88A58" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span style={{ fontSize: '6.5px', color: '#FFFFFF', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {ORG_PHONE}
            </span>
          </div>

          {/* Website */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#C88A58" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span style={{ fontSize: '6.5px', color: '#FFFFFF', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {ORG_WEBSITE}
            </span>
          </div>
        </div>

      </div>
    </CardShell>
  );
}

/* ────────────────────── Full Card preview (front + back) ────────────────────── */
export function ZakatCardPreview({ card }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <div className="membership-card-wrapper">
        <ZakatCardFront card={card} />
      </div>
      <div className="membership-card-wrapper">
        <ZakatCardBack card={card} />
      </div>
    </div>
  );
}

export default ZakatCardPreview;
