import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA WELFARE';
const ORG_LINE2    = 'JAMAT';
const ORG_REGD     = '(REGD. 1219)';
const ORG_RETURN   = 'If found please return it to Kutchi Muslim Loharwada Jamat, Jumma Baloch Road, New Kalri, Lyari, Karachi.';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

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
      background: 'linear-gradient(135deg, #D7DCE2 0%, #F0F3F5 50%, #C9CED6 100%)',
      border: '3.5px solid #061539',
      borderRadius: 'inherit',
      boxSizing: 'border-box',
    }}>
      {/* Watermark crest (high visibility center logo watermark) */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.22, pointerEvents: 'none',
        filter: 'contrast(1.25)',
      }}>
        <img src={logoSrc} alt="" style={{ width: '70%', height: 'auto', objectFit: 'contain' }} />
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────── FRONT ─────────────────────────────────── */
export function CardFront({ member }) {
  return (
    <CardShell>
      {/* ── BODY: band + photo | header + details + logo ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'row',
      }}>
        {/* ── LEFT: Dark Navy Vertical Ribbon Band with Profile Photo ── */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '84px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* vertical navy stripe */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '18px',
            background: 'linear-gradient(180deg, #091D4A 0%, #061539 50%, #030C24 100%)',
            boxShadow: '0 0 4px rgba(6,21,57,0.3)',
          }} />
          {/* Portrait Photo (70px x 102px - 1:1.50 Aspect Ratio) */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '70px', height: '102px',
            aspectRatio: '1 / 1.5',
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '2.5px solid #061539',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
          }}>
            {member?.photoUrl ? (
              <img src={member.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1 / 1.5' }} />
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
          {/* Header: KUTCHI MUSLIM LOHARWADA WELFARE */}
          <div style={{ textAlign: 'center', paddingRight: '56px' }}>
            <div style={{
              fontSize: '8.5px', fontWeight: 900, color: '#000000',
              letterSpacing: '0.01em', lineHeight: 1.15, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {ORG_LINE1}
            </div>
            <div style={{
              fontSize: '9.5px', fontWeight: 900, color: '#000000',
              letterSpacing: '0.06em', lineHeight: 1.15, textTransform: 'uppercase',
            }}>
              {ORG_LINE2} <span style={{ fontSize: '7.5px', color: '#555555', fontWeight: 800 }}>{ORG_REGD}</span>
            </div>
            
            {/* Deep Navy Pill Badge */}
            <div style={{
              display: 'inline-block',
              background: '#061539',
              color: '#FFFFFF',
              fontSize: '9.5px', fontWeight: 900,
              letterSpacing: '0.14em', marginTop: '2px', padding: '1.5px 12px',
              borderRadius: '12px', textTransform: 'uppercase',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              MEMBERSHIP CARD
            </div>
          </div>

          {/* Details list */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: '2.5px',
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
                  fontSize: '10.5px', color: '#000000', fontWeight: 900,
                  minWidth: '84px', flexShrink: 0, letterSpacing: '0.01em',
                }}>
                  {label}:
                </span>
                <span style={{
                  fontSize: '10.5px', color: '#000000', fontWeight: 800,
                  lineHeight: 1.25, wordBreak: 'break-all',
                }}>
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOP-RIGHT: Enlarged Prominent Logo Badge ── */}
        <div style={{
          position: 'absolute', top: '2px', right: '3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
          background: 'rgba(6, 21, 57, 0.08)',
          border: '1.5px solid rgba(6, 21, 57, 0.25)',
          borderRadius: '8px',
          padding: '2px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          <img src={logoSrc} alt="Logo" style={{
            width: '52px', height: '52px', objectFit: 'contain',
          }} />
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: '#061539',
        padding: '3px 8px',
        display: 'flex', alignItems: 'center', gap: '6px',
        minHeight: '20px',
      }}>
        <svg width="10" height="12" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill="#FFFFFF"/>
        </svg>
        <span style={{ fontSize: '8px', color: '#FFFFFF', fontWeight: 700, lineHeight: 1.25 }}>
          {ORG_RETURN}
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
        background: '#061539',
      }}>
        <div style={{
          fontSize: '10.5px', fontWeight: 900, color: '#FFFFFF',
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
                  fontSize: '10.5px', color: '#000000', fontWeight: 900,
                  minWidth: '78px', flexShrink: 0,
                }}>
                  {label}:
                </span>
                <span style={{ fontSize: '10.5px', color: '#000000', fontWeight: 800, lineHeight: 1.25 }}>
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
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                border: '1px solid #061539',
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
              <span style={{ fontSize: '6px', color: '#000000', fontWeight: 900, letterSpacing: '0.04em' }}>
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
                borderBottom: '1.5px solid #061539',
                marginBottom: '2px', height: '10px',
              }} />
              <span style={{ fontSize: '8.5px', color: '#000000', fontWeight: 900, letterSpacing: '0.04em' }}>
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: '#061539',
        padding: '3px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px',
      }}>
        <span style={{ fontSize: '8.5px', color: '#FFFFFF', fontWeight: 700 }}>
          <span style={{ fontWeight: 800 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '8.5px', color: '#FFFFFF', fontWeight: 700 }}>
          <span style={{ fontWeight: 800 }}>Web:</span> {ORG_WEBSITE}
        </span>
        {/* Sparkle icon at far right of back footer */}
        <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.9 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
          </svg>
        </div>
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


