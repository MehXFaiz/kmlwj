import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA';
const ORG_LINE2    = 'WELFARE JAMAT';
const ORG_REGD     = '(REGD. 1319)';
const ORG_RETURN   = 'Kutchi Muslim Loharwada Jamat, Jumma Baloch Road, New Kalri, Lyari, Karachi.';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

/* ── Reference palette ── */
const GREEN       = '#1a4a2e';   // card background
const GREEN_DEEP  = '#153f27';
const GOLD        = '#C9A227';   // labels / titles
const GOLD_TEXT   = '#D4AF37';
const OLIVE       = '#9d8f56';   // outer border
const OLIVE_DARK  = '#847844';
const BAND_GOLD   = '#b39c55';   // vertical band + bottom strip
const STRIP_GOLD  = '#cdbb82';   // bottom cream/gold strip
const WHITE       = '#FFFFFF';
const CREAM       = '#F5F0E0';

function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* Shared shell: olive-gold border all round, dark green face, faint crest watermark */
function CardShell({ children }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: GREEN,
      border: `3px solid ${OLIVE}`,
      boxShadow: `inset 0 0 0 1px ${OLIVE_DARK}`,
      borderRadius: 'inherit',
    }}>
      {/* Watermark crest behind content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.07, pointerEvents: 'none',
      }}>
        <img src={logoSrc} alt="" style={{ width: '58%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT ─────────────────────────────────── */
export function CardFront({ member }) {
  const BASE_URL = 'https://kmlwj.com/member/verify';
  const qrValue = member?.memberNo
    ? `${BASE_URL}/${member.memberNo}`
    : member?.id
    ? `${BASE_URL}/${member.id}`
    : 'https://kmlwj.com';

  return (
    <CardShell>
      {/* ── HEADER ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        padding: '5px 8px 3px 10px',
        display: 'flex', alignItems: 'flex-start',
      }}>
        {/* Centered org text */}
        <div style={{ flex: 1, textAlign: 'center', paddingLeft: '26px' }}>
          <div style={{
            fontSize: '8px', fontWeight: 800, color: WHITE,
            letterSpacing: '0.05em', lineHeight: 1.3, textTransform: 'uppercase',
          }}>
            {ORG_LINE1}
          </div>
          <div style={{
            fontSize: '8px', fontWeight: 800, color: WHITE,
            letterSpacing: '0.05em', lineHeight: 1.3, textTransform: 'uppercase',
          }}>
            {ORG_LINE2}
          </div>
          <div style={{
            fontSize: '5.2px', color: 'rgba(245,240,224,0.85)', fontWeight: 700,
            letterSpacing: '0.06em', marginTop: '1px', lineHeight: 1.2,
          }}>
            {ORG_REGD}
          </div>
          <div style={{
            fontSize: '7.5px', fontWeight: 800, color: GOLD_TEXT,
            letterSpacing: '0.18em', marginTop: '2px', textTransform: 'uppercase',
          }}>
            MEMBERSHIP CARD
          </div>
          {/* Gold rule under title */}
          <div style={{
            height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            marginTop: '2px', marginLeft: '8%', marginRight: '8%',
          }} />
        </div>

        {/* Right column: crest then QR */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '3px', flexShrink: 0, marginLeft: '4px',
        }}>
          <img src={logoSrc} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          <div style={{ background: WHITE, padding: '2px', borderRadius: '2px' }}>
            <QRCodeSVG value={qrValue} size={30} bgColor={WHITE} fgColor="#000000" level="M" />
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', alignItems: 'center', gap: '0',
        padding: '2px 8px 3px 0',
      }}>
        {/* Gold vertical band behind the portrait */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '58px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', top: '-40px', bottom: '-4px', left: '14px', width: '13px',
            background: `linear-gradient(180deg, ${BAND_GOLD}, ${OLIVE_DARK}, ${BAND_GOLD})`,
          }} />
          {/* Portrait box */}
          <div style={{
            position: 'relative',
            width: '44px', height: '56px',
            background: WHITE, borderRadius: '8px',
            border: `1.5px solid ${OLIVE_DARK}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}>
            {member?.photoUrl ? (
              <img src={member.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '5.5px', color: '#555', fontWeight: 500 }}>portrait here</span>
            )}
          </div>
        </div>

        {/* Member details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3.5px', paddingLeft: '6px' }}>
          {[
            ['Membership No', member?.memberNo],
            ['Name',          member?.fullName],
            ['F. Name',       member?.fatherName],
            ['D.O.B',         fmtDate(member?.dob)],
            ['CNIC',          member?.cnic],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{
                fontSize: '7px', color: GOLD_TEXT, fontWeight: 800,
                minWidth: '58px', flexShrink: 0, letterSpacing: '0.01em',
              }}>
                {label}:
              </span>
              <span style={{
                fontSize: '7px', color: WHITE, fontWeight: 600,
                lineHeight: 1.2, wordBreak: 'break-all',
              }}>
                {fmt(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: STRIP_GOLD,
        borderTop: `1px solid ${OLIVE_DARK}`,
        padding: '3px 8px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {/* Location pin */}
        <svg width="7" height="9" viewBox="0 0 12 16" style={{ flexShrink: 0 }}>
          <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6zm0 8.4A2.4 2.4 0 1 1 6 3.6a2.4 2.4 0 0 1 0 4.8z" fill="#1a2e1f"/>
        </svg>
        <span style={{ fontSize: '5.6px', color: '#1a2e1f', fontWeight: 600, lineHeight: 1.35 }}>
          If found please return it to {ORG_RETURN}
        </span>
      </div>
    </CardShell>
  );
}

/* ─────────────────────────────────── BACK ─────────────────────────────────── */
export function CardBack({ member }) {
  return (
    <CardShell>
      {/* ── HEADER ── */}
      <div style={{
        position: 'relative', zIndex: 3, textAlign: 'center',
        padding: '7px 12px 4px',
      }}>
        <div style={{
          fontSize: '8px', fontWeight: 800, color: GOLD_TEXT,
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>
          MEMBER INFORMATION
        </div>
        <div style={{
          height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          marginTop: '3px', marginLeft: '14%', marginRight: '14%',
        }} />
      </div>

      {/* ── BODY ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'column', gap: '4.5px',
        padding: '5px 16px 0 18px',
      }}>
        {[
          ['Ghaam',        member?.ghamName],
          ['Address',      member?.address ? (member.address.length > 40 ? member.address.slice(0, 40) + '…' : member.address) : null],
          ['Contact',      member?.mobile],
          ['Issuing Date', fmtDate(member?.doi)],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{
              fontSize: '7px', color: GOLD_TEXT, fontWeight: 800,
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
        background: STRIP_GOLD,
        borderTop: `1px solid ${OLIVE_DARK}`,
        padding: '3px 10px',
        display: 'flex', flexWrap: 'wrap', gap: '12px',
      }}>
        <span style={{ fontSize: '5.8px', color: '#1a2e1f', fontWeight: 600 }}>
          <span style={{ fontWeight: 800 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '5.8px', color: '#1a2e1f', fontWeight: 600 }}>
          <span style={{ fontWeight: 800 }}>Web:</span> {ORG_WEBSITE}
        </span>
      </div>
    </CardShell>
  );
}

/* ────────────────────── Full Card preview (front + back) ────────────────────── */
export function MembershipCardPreview({ member }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <div className="membership-card-wrapper">
        <CardFront member={member} />
      </div>
      <div className="membership-card-wrapper">
        <CardBack member={member} />
      </div>
    </div>
  );
}
