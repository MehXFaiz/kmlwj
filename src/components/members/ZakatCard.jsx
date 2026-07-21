import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA';
const ORG_LINE2    = 'WELFARE JAMAT';
const ORG_REGD     = '(REGD. 1319)';
const ORG_RETURN   = 'Kutchi Muslim Loharwada Jamat, Jumma Baloch Road, New Kalri, Lyari, Karachi.';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

/* ── Design palette (matches PHP print template) ── */
const GREEN      = '#0b4f2d';
const GOLD       = '#b59a5a';
const GOLD_LABEL = '#d8c07a';
const GOLD_TYPE  = '#ffb347';
const DIVIDER    = 'rgba(204,106,43,0.95)';
const WHITE      = '#FFFFFF';
const DARK_TEXT  = '#08120a';

function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtAmount(val) {
  if (!val && val !== 0) return '—';
  return `Rs ${Number(val).toLocaleString('en-PK')}`;
}

/* Shared shell */
function CardShell({ children }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: GREEN,
      border: `4px solid ${GOLD}`,
      borderRadius: 'inherit',
      boxSizing: 'border-box',
    }}>
      {/* Watermark crest */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.08, pointerEvents: 'none',
      }}>
        <img src={logoSrc} alt="" style={{ width: '55%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT ─────────────────────────────────── */
export function ZakatCardFront({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const displayName = beneficiary?.name || member?.fullName || '';
  const displayCnic = beneficiary?.cnic || null;
  const BASE_URL = 'https://kmlwj.com/member/verify';
  const qrValue = member?.memberNo
    ? `${BASE_URL}/${member.memberNo}`
    : beneficiary?.id
    ? `${BASE_URL}/${beneficiary.id}`
    : member?.id
    ? `${BASE_URL}/${member.id}`
    : 'https://kmlwj.com';

  return (
    <CardShell>
      {/* ── BODY: band + photo | header + details + logo/qr ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'row',
      }}>
        {/* ── LEFT: Gold vertical band with portrait ── */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '68px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '14px',
            background: GOLD,
            borderRadius: '2px',
          }} />
          <div style={{
            position: 'relative', zIndex: 2,
            width: '46px', height: '58px',
            background: WHITE,
            borderRadius: '10px',
            border: `3px solid ${GOLD}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 8px rgba(0,0,0,0.5)',
          }}>
            {member?.photoUrl ? (
              <img src={member.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '5px', color: '#555', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>portrait{'\n'}here</span>
            )}
          </div>
        </div>

        {/* ── MAIN: header + details ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '6px 6px 0 6px', minWidth: 0,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', paddingRight: '44px' }}>
            <div style={{
              fontSize: '8.5px', fontWeight: 800, color: GOLD_LABEL,
              letterSpacing: '0.05em', lineHeight: 1.3, textTransform: 'uppercase',
            }}>
              {ORG_LINE1}
            </div>
            <div style={{
              fontSize: '8.5px', fontWeight: 800, color: GOLD_LABEL,
              letterSpacing: '0.05em', lineHeight: 1.3, textTransform: 'uppercase',
            }}>
              {ORG_LINE2}
            </div>
            <div style={{
              fontSize: '5px', color: 'rgba(245,240,224,0.85)', fontWeight: 700,
              letterSpacing: '0.06em', marginTop: '1px', lineHeight: 1.2,
            }}>
              {ORG_REGD}
            </div>
            <div style={{
              fontSize: '7px', fontWeight: 800, color: GOLD_TYPE,
              letterSpacing: '0.18em', marginTop: '2px', textTransform: 'uppercase',
            }}>
              ZAKAT CARD
            </div>
            <div style={{
              height: '2px', background: DIVIDER,
              margin: '2px auto 0', width: '80%',
              borderRadius: '1px',
            }} />
          </div>

          {/* Details */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: '2.5px',
            padding: '3px 4px 0 4px',
          }}>
            {[
              ['Zakat Card No', card?.cardNumber],
              ['Name',          displayName],
              ['CNIC',          displayCnic || member?.cnic],
              ['S/O',           member?.fatherName],
              ['Area / Jamaat', member?.area || member?.ghamName],
              ['Zakat Amount',  fmtAmount(card?.zakatAmount)],
              ['Issue Date',    fmtDate(card?.issueDate)],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{
                  fontSize: '6.5px', color: GOLD_LABEL, fontWeight: 800,
                  minWidth: '62px', flexShrink: 0, letterSpacing: '0.01em',
                }}>
                  {label}:
                </span>
                <span style={{
                  fontSize: '6.5px', color: WHITE, fontWeight: 600,
                  lineHeight: 1.2, wordBreak: 'break-all',
                }}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOP-RIGHT: Logo + QR stacked ── */}
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', zIndex: 10,
        }}>
          <img src={logoSrc} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div style={{ background: WHITE, padding: '2px', borderRadius: '3px' }}>
            <QRCodeSVG value={qrValue} size={32} bgColor={WHITE} fgColor="#000000" level="M" />
          </div>
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: GOLD,
        padding: '4px 8px',
        display: 'flex', alignItems: 'center', gap: '5px',
        minHeight: '20px',
      }}>
        <svg width="8" height="10" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill={DARK_TEXT}/>
        </svg>
        <span style={{ fontSize: '5.5px', color: DARK_TEXT, fontWeight: 600, lineHeight: 1.35 }}>
          If found please return it to {ORG_RETURN}
        </span>
      </div>
    </CardShell>
  );
}

/* ─────────────────────────────────── BACK ─────────────────────────────────── */
export function ZakatCardBack({ card }) {
  const beneficiary = card?.beneficiary || null;
  const member = card?.member || null;
  const address = beneficiary?.address || member?.address;
  const mobile = beneficiary?.mobile || member?.mobile;

  return (
    <CardShell>
      {/* ── HEADER ── */}
      <div style={{
        position: 'relative', zIndex: 3, textAlign: 'center',
        padding: '7px 12px 4px',
        borderBottom: `2px solid ${GOLD}`,
      }}>
        <div style={{
          fontSize: '8px', fontWeight: 800, color: GOLD_TYPE,
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>
          BENEFICIARY INFORMATION
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '6px 16px 0 18px',
      }}>
        {[
          ['Ghaam',        member?.ghamName],
          ['Address',      address ? (address.length > 40 ? address.slice(0, 40) + '…' : address) : null],
          ['Contact',      mobile],
          ['Issuing Date', fmtDate(card?.issueDate)],
        ].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{
              fontSize: '7px', color: GOLD_LABEL, fontWeight: 800,
              minWidth: '58px', flexShrink: 0,
            }}>
              {label}:
            </span>
            <span style={{ fontSize: '7px', color: WHITE, fontWeight: 600, lineHeight: 1.3 }}>
              {fmt(value)}
            </span>
          </div>
        ))}

        {/* Signature lines */}
        <div style={{
          marginTop: 'auto', paddingBottom: '5px',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          {['Chairman', 'President'].map(title => (
            <div key={title} style={{ textAlign: 'center', minWidth: '68px' }}>
              <div style={{
                borderBottom: `1px solid ${WHITE}`,
                marginBottom: '2px', height: '12px',
              }} />
              <span style={{ fontSize: '6px', color: WHITE, fontWeight: 700, letterSpacing: '0.04em' }}>
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: GOLD,
        padding: '4px 10px',
        display: 'flex', flexWrap: 'wrap', gap: '12px',
      }}>
        <span style={{ fontSize: '5.8px', color: DARK_TEXT, fontWeight: 600 }}>
          <span style={{ fontWeight: 800 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '5.8px', color: DARK_TEXT, fontWeight: 600 }}>
          <span style={{ fontWeight: 800 }}>Web:</span> {ORG_WEBSITE}
        </span>
      </div>
    </CardShell>
  );
}
