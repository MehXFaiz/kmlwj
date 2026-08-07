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
      background: 'linear-gradient(135deg, #022013 0%, #004D28 50%, #012D1B 100%)',
      border: '3px solid #FFD700',
      outline: '1px solid rgba(255,215,0,0.5)',
      outlineOffset: '-4px',
      borderRadius: 'inherit',
      boxSizing: 'border-box',
    }}>
      {/* Geometric Gold Accent Shapes */}
      <div style={{
        position: 'absolute', top: '-25px', right: '-25px', width: '120px', height: '120px',
        background: 'radial-gradient(circle, rgba(255,215,0,0.18) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{
        position: 'absolute', bottom: '-20px', left: '-20px', width: '100px', height: '100px',
        background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Watermark crest */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.15, pointerEvents: 'none',
        filter: 'brightness(2.4) contrast(1.4)',
      }}>
        <img src={logoSrc} alt="" style={{ width: '54%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT ─────────────────────────────────── */
export function CardFront({ member }) {
  return (
    <CardShell>
      {/* ── BODY ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'row',
      }}>
        {/* ── LEFT: Gold Ribbon Band with Portrait ── */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '78px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* vertical gold band with metallic shine */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '16px',
            background: 'linear-gradient(180deg, #FFE082 0%, #D4AF37 50%, #997415 100%)',
            boxShadow: '0 0 8px rgba(212,175,55,0.4)',
          }} />
          {/* Portrait (64px x 64px, 1:1 ratio) */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '64px', height: '64px',
            aspectRatio: '1 / 1',
            background: '#FFFFFF',
            borderRadius: '12px',
            border: '2.5px solid #FFD700',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.7), 0 0 8px rgba(255,215,0,0.3)',
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
          {/* Header */}
          <div style={{ textAlign: 'center', paddingRight: '50px' }}>
            <div style={{
              fontSize: '8.2px', fontWeight: 900, color: '#FFE082',
              letterSpacing: '0.02em', lineHeight: 1.15, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}>
              {ORG_LINE1}
            </div>
            <div style={{
              fontSize: '9px', fontWeight: 900, color: '#FFE082',
              letterSpacing: '0.06em', lineHeight: 1.15, textTransform: 'uppercase',
            }}>
              {ORG_LINE2} <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.9)', fontWeight: 800 }}>{ORG_REGD}</span>
            </div>
            
            {/* Solid Metallic Gold Pill Badge */}
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)',
              color: '#022013',
              fontSize: '9px', fontWeight: 900,
              letterSpacing: '0.15em', marginTop: '2px', padding: '1.5px 10px',
              borderRadius: '12px', textTransform: 'uppercase',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}>
              MEMBERSHIP CARD
            </div>
          </div>

          {/* Details list with Frosted Glass Rows */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: '2px',
            padding: '3px 2px 0 2px',
          }}>
            {[
              ['Membership No', member?.memberNo],
              ['Name',          member?.fullName],
              ['F. Name',       member?.fatherName],
              ['D.O.B',         fmtDate(member?.dob)],
              ['CNIC',          member?.cnic],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'baseline', gap: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px', padding: '1px 4px',
                borderLeft: '2px solid #FFD700',
              }}>
                <span style={{
                  fontSize: '9px', color: '#FFE082', fontWeight: 900,
                  minWidth: '76px', flexShrink: 0, letterSpacing: '0.01em',
                }}>
                  {label}:
                </span>
                <span style={{
                  fontSize: '9px', color: '#FFFFFF', fontWeight: 800,
                  lineHeight: 1.2, wordBreak: 'break-all',
                }}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOP-RIGHT: Embossed Gold Logo Coin ── */}
        <div style={{
          position: 'absolute', top: '3px', right: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
          background: 'linear-gradient(135deg, rgba(255,215,0,0.3) 0%, rgba(184,134,11,0.15) 100%)',
          border: '1.5px solid #FFD700',
          borderRadius: '50%',
          width: '42px', height: '42px',
          boxShadow: '0 0 10px rgba(255,215,0,0.5)',
        }}>
          <img src={logoSrc} alt="Logo" style={{
            width: '36px', height: '36px', objectFit: 'contain',
            filter: 'brightness(2.4) contrast(1.5) drop-shadow(0 0 3px #FFD700)',
          }} />
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: 'linear-gradient(90deg, #FFE082 0%, #D4AF37 50%, #FFE082 100%)',
        padding: '3px 8px',
        display: 'flex', alignItems: 'center', gap: '6px',
        minHeight: '20px',
        boxShadow: '0 -2px 6px rgba(0,0,0,0.3)',
      }}>
        <svg width="10" height="12" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill="#022013"/>
        </svg>
        <span style={{ fontSize: '8px', color: '#022013', fontWeight: 900, lineHeight: 1.25 }}>
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
        padding: '4px 12px 3px',
        background: 'rgba(255, 215, 0, 0.15)',
        borderBottom: '2px solid #FFD700',
      }}>
        <div style={{
          fontSize: '9.5px', fontWeight: 900, color: '#FFE082',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '4px' }}>
            {[
              ['Ghaam',        member?.ghamName],
              ['Address',      member?.address ? (member.address.length > 45 ? member.address.slice(0, 45) + '…' : member.address) : null],
              ['Contact',      member?.mobile],
              ['Issuing Date', fmtDate(member?.doi)],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'baseline', gap: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px', padding: '1.5px 5px',
                borderLeft: '2px solid #FFD700',
              }}>
                <span style={{
                  fontSize: '9px', color: '#FFE082', fontWeight: 900,
                  minWidth: '70px', flexShrink: 0,
                }}>
                  {label}:
                </span>
                <span style={{ fontSize: '9px', color: '#FFFFFF', fontWeight: 800, lineHeight: 1.25 }}>
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
                background: '#FFFFFF',
                padding: '3px',
                borderRadius: '6px',
                width: '50px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 2px 10px rgba(0,0,0,0.6), 0 0 6px rgba(255,215,0,0.3)',
                border: '1.5px solid #FFD700',
              }}>
                <QRCodeSVG
                  value={qrValue}
                  size={512}
                  bgColor="#FFFFFF"
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
              <span style={{ fontSize: '6px', color: '#FFE082', fontWeight: 900, letterSpacing: '0.04em' }}>
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
                borderBottom: '1.5px solid #FFD700',
                marginBottom: '2px', height: '10px',
              }} />
              <span style={{ fontSize: '8px', color: '#FFE082', fontWeight: 900, letterSpacing: '0.04em' }}>
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: 'linear-gradient(90deg, #FFE082 0%, #D4AF37 50%, #FFE082 100%)',
        padding: '3px 10px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px',
        boxShadow: '0 -2px 6px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: '8px', color: '#022013', fontWeight: 800 }}>
          <span style={{ fontWeight: 900 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '8px', color: '#022013', fontWeight: 800 }}>
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

