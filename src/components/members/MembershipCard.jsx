import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA WELFARE';
const ORG_LINE2    = 'JAMAT';
const ORG_REGD     = '(REGD. 1219)';
const ORG_RETURN   = 'Kutchi Muslim Loharwada Jamat, Jumma Baloch Road, New Kalri, Lyari, Karachi.';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

/* ── Design palette (Bright, Vibrant & Highly Legible) ── */
const GREEN      = '#006837';   // Vibrant bright emerald/forest green
const GOLD       = '#D4AF37';   // Bright gold border and accents
const GOLD_LABEL = '#FFD54F';   // High-contrast bright yellow/gold for labels
const GOLD_TYPE  = '#FFC107';   // Bright yellow gold card type heading
const DIVIDER    = '#FF9800';   // Bright orange rule under heading
const WHITE      = '#FFFFFF';
const DARK_TEXT  = '#0A2912';   // Rich dark text on golden footer strip

function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
        opacity: 0.16, pointerEvents: 'none',
        filter: 'brightness(1.8) contrast(1.2)',
      }}>
        <img src={logoSrc} alt="" style={{ width: '58%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT ─────────────────────────────────── */
export function CardFront({ member }) {
  return (
    <CardShell>
      {/* ── BODY: band + photo | header + details + big logo ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'row',
      }}>
        {/* ── LEFT: Gold vertical band with portrait ── */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '84px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* vertical band */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '18px',
            background: GOLD,
            borderRadius: '2px',
          }} />
          {/* Portrait (1:1 Aspect Ratio - 68px x 68px) */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '68px', height: '68px',
            aspectRatio: '1 / 1',
            background: WHITE,
            borderRadius: '10px',
            border: `3px solid ${GOLD}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          }}>
            {member?.photoUrl ? (
              <img src={member.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1 / 1' }} />
            ) : (
              <span style={{ fontSize: '7px', color: '#555', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>portrait{'\n'}here</span>
            )}
          </div>
        </div>

        {/* ── MAIN: header + details ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '4px 4px 0 2px', minWidth: 0,
        }}>
          {/* Header: KUTCHI MUSLIM LOHARWADA WELFARE in one single line without overlapping logo */}
          <div style={{ textAlign: 'center', paddingRight: '56px' }}>
            <div style={{
              fontSize: '8.4px', fontWeight: 900, color: GOLD_LABEL,
              letterSpacing: '0em', lineHeight: 1.2, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {ORG_LINE1}
            </div>
            <div style={{
              fontSize: '9.5px', fontWeight: 900, color: GOLD_LABEL,
              letterSpacing: '0.08em', lineHeight: 1.2, textTransform: 'uppercase',
            }}>
              {ORG_LINE2} <span style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.95)', fontWeight: 800, letterSpacing: '0.04em' }}>{ORG_REGD}</span>
            </div>
            <div style={{
              fontSize: '10.5px', fontWeight: 900, color: GOLD_TYPE,
              letterSpacing: '0.16em', marginTop: '1px', textTransform: 'uppercase',
            }}>
              MEMBERSHIP CARD
            </div>
            {/* Orange divider */}
            <div style={{
              height: '2px', background: DIVIDER,
              margin: '2px auto 0', width: '85%',
              borderRadius: '1px',
            }} />
          </div>

          {/* Details */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: '3px',
            padding: '3px 2px 0 2px',
          }}>
            {[
              ['Membership No', member?.memberNo],
              ['Name',          member?.fullName],
              ['F. Name',       member?.fatherName],
              ['D.O.B',         fmtDate(member?.dob)],
              ['CNIC',          member?.cnic],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{
                  fontSize: '10.5px', color: GOLD_LABEL, fontWeight: 900,
                  minWidth: '84px', flexShrink: 0, letterSpacing: '0.01em',
                }}>
                  {label}:
                </span>
                <span style={{
                  fontSize: '10.5px', color: WHITE, fontWeight: 800,
                  lineHeight: 1.25, wordBreak: 'break-all',
                }}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOP-RIGHT: Bright Gold Emblem Logo ── */}
        <div style={{
          position: 'absolute', top: '3px', right: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
          background: 'rgba(255, 213, 79, 0.2)',
          border: '1.5px solid #FFD54F',
          borderRadius: '10px',
          padding: '2px',
          boxShadow: '0 0 8px rgba(255,213,79,0.5)',
        }}>
          <img src={logoSrc} alt="Logo" style={{
            width: '42px', height: '42px', objectFit: 'contain',
            filter: 'brightness(2.2) contrast(1.4) drop-shadow(0 0 3px #FFD54F)',
          }} />
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: GOLD,
        padding: '3px 8px',
        display: 'flex', alignItems: 'center', gap: '6px',
        minHeight: '22px',
      }}>
        <svg width="10" height="12" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill={DARK_TEXT}/>
        </svg>
        <span style={{ fontSize: '8.5px', color: DARK_TEXT, fontWeight: 800, lineHeight: 1.3 }}>
          If found please return it to {ORG_RETURN}
        </span>
      </div>
    </CardShell>
  );
}

/* ─────────────────────────────────── BACK ─────────────────────────────────── */
export function CardBack({ member }) {
  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = member?.memberNo
    ? `${VERIFY_BASE}/verify/member/${encodeURIComponent(member.memberNo)}`
    : null;

  return (
    <CardShell>
      {/* ── HEADER ── */}
      <div style={{
        position: 'relative', zIndex: 3, textAlign: 'center',
        padding: '5px 12px 3px',
        borderBottom: `2px solid ${GOLD}`,
      }}>
        <div style={{
          fontSize: '11px', fontWeight: 900, color: GOLD_TYPE,
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>
          MEMBER INFORMATION
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '5px 10px 0 12px',
      }}>
        {/* Details list + QR Code side-by-side */}
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5px', flex: 1, paddingRight: '4px' }}>
            {[
              ['Ghaam',        member?.ghamName],
              ['Address',      member?.address ? (member.address.length > 45 ? member.address.slice(0, 45) + '…' : member.address) : null],
              ['Contact',      member?.mobile],
              ['Issuing Date', fmtDate(member?.doi)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{
                  fontSize: '10.5px', color: GOLD_LABEL, fontWeight: 900,
                  minWidth: '78px', flexShrink: 0,
                }}>
                  {label}:
                </span>
                <span style={{ fontSize: '10.5px', color: WHITE, fontWeight: 800, lineHeight: 1.25 }}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>

          {/* QR Code placed on Back side */}
          {qrValue && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0,
              marginLeft: '4px'
            }}>
              <div style={{
                background: WHITE,
                padding: '3px',
                borderRadius: '4px',
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}>
                <QRCodeSVG
                  value={qrValue}
                  size={512}
                  bgColor={WHITE}
                  fgColor="#000000"
                  level="H"
                  includeMargin={true}
                  marginSize={4}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    imageRendering: 'pixelated',
                    shapeRendering: 'crispEdges',
                  }}
                />
              </div>
              <span style={{ fontSize: '6px', color: GOLD_LABEL, fontWeight: 900, letterSpacing: '0.04em' }}>
                VERIFY QR
              </span>
            </div>
          )}
        </div>

        {/* Signature lines */}
        <div style={{
          marginTop: 'auto', paddingBottom: '3px',
          display: 'flex', justifyContent: 'space-around',
          alignItems: 'flex-end',
        }}>
          {['Chairman', 'President'].map(title => (
            <div key={title} style={{ textAlign: 'center', minWidth: '75px' }}>
              <div style={{
                borderBottom: `1.5px solid ${WHITE}`,
                marginBottom: '2px', height: '10px',
              }} />
              <span style={{ fontSize: '8.5px', color: WHITE, fontWeight: 900, letterSpacing: '0.04em' }}>
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
        padding: '3px 10px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px',
      }}>
        <span style={{ fontSize: '8.5px', color: DARK_TEXT, fontWeight: 800 }}>
          <span style={{ fontWeight: 900 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '8.5px', color: DARK_TEXT, fontWeight: 800 }}>
          <span style={{ fontWeight: 900 }}>Web:</span> {ORG_WEBSITE}
        </span>
      </div>
    </CardShell>
  );
}

/* ────────────────────── Full Card preview (front + back) ────────────────────── */
export function MembershipCardPreview({ member }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <div className="membership-card-wrapper">
        <CardFront member={member} />
      </div>
      <div className="membership-card-wrapper">
        <CardBack member={member} />
      </div>
    </div>
  );
}

