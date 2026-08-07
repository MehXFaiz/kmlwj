import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA WELFARE';
const ORG_LINE2    = 'JAMAT';
const ORG_REGD     = '(REGD. 1219)';
const ORG_RETURN   = 'Kutchi Muslim Loharwada Jamat, Jumma Baloch Road, New Kalri, Lyari, Karachi.';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

/* ── Design palette (Bright Warm Gold/Amber & Brown) ── */
const PRIMARY_BG     = '#6D2800';  // Rich warm brown
const BORDER         = '#E5B83B';  // Bright gold border
const ACCENT_BROWN   = '#E5B83B';  // Bright gold footer strip
const LIGHT_CREAM    = '#FFE082';  // Bright golden yellow text
const DIVIDER        = '#FF9800';  // Bright orange divider
const PRIMARY_TEXT   = '#FFFFFF';
const SECONDARY_TEXT = '#FFD54F';  // Bright gold labels
const MUTED_TEXT     = '#FFECB3';
const BADGE_BG       = '#FFFFFF';
const DARK_TEXT      = '#2C1605';
const WATERMARK_OPACITY = 0.16;

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
function CardShell({ children }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #4A1A02 0%, #7D2E00 50%, #4A1A02 100%)',
      border: `3.5px solid ${BORDER}`,
      borderRadius: 'inherit',
      boxSizing: 'border-box',
    }}>
      {/* Background radial highlight & watermark */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at 65% 35%, rgba(255, 224, 130, 0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: WATERMARK_OPACITY, pointerEvents: 'none',
        filter: 'brightness(2.0) contrast(1.3)',
      }}>
        <img src={logoSrc} alt="" style={{ width: '56%', height: 'auto', objectFit: 'contain' }} />
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

  return (
    <CardShell>
      {/* ── BODY: band + photo | header + details + logo ── */}
      <div style={{
        position: 'relative', zIndex: 3, flex: 1,
        display: 'flex', flexDirection: 'row',
      }}>
        {/* ── LEFT: Gold vertical band with portrait ── */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '80px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '14px',
            background: 'linear-gradient(180deg, #FFE082 0%, #E5B83B 50%, #B38F24 100%)',
            borderRadius: '2px',
          }} />
          {/* Portrait (1:1 Aspect Ratio - 66px x 66px) */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '66px', height: '66px',
            aspectRatio: '1 / 1',
            background: PRIMARY_TEXT,
            borderRadius: '10px',
            border: `2.5px solid ${BORDER}`,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}>
            {(beneficiary?.photoUrl || member?.photoUrl) ? (
              <img src={beneficiary?.photoUrl || member?.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1 / 1' }} />
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
          {/* Header: KUTCHI MUSLIM LOHARWADA WELFARE in one single line without logo overlap */}
          <div style={{ textAlign: 'center', paddingRight: '54px' }}>
            <div style={{
              fontSize: '8.4px', fontWeight: 900, color: LIGHT_CREAM,
              letterSpacing: '0.01em', lineHeight: 1.15, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {ORG_LINE1}
            </div>
            <div style={{
              fontSize: '9.2px', fontWeight: 900, color: LIGHT_CREAM,
              letterSpacing: '0.06em', lineHeight: 1.15, textTransform: 'uppercase',
            }}>
              {ORG_LINE2} <span style={{ fontSize: '7.2px', color: MUTED_TEXT, fontWeight: 800 }}>{ORG_REGD}</span>
            </div>
            
            {/* Zakat Card Gold Badge */}
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #FFE082 0%, #E5B83B 100%)',
              color: DARK_TEXT,
              fontSize: '9px', fontWeight: 900,
              letterSpacing: '0.14em', marginTop: '2px', padding: '1px 8px',
              borderRadius: '3px', textTransform: 'uppercase',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}>
              ZAKAT CARD
            </div>
          </div>

          {/* Details */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', gap: '2.5px',
            padding: '4px 2px 0 2px',
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
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{
                  fontSize: '9.2px', color: SECONDARY_TEXT, fontWeight: 900,
                  minWidth: '78px', flexShrink: 0, letterSpacing: '0.01em',
                }}>
                  {label}:
                </span>
                <span style={{
                  fontSize: '9.2px', color: PRIMARY_TEXT, fontWeight: 800,
                  lineHeight: 1.2, wordBreak: 'break-all',
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
          background: 'rgba(255, 224, 130, 0.22)',
          border: '1.5px solid #FFE082',
          borderRadius: '8px',
          padding: '2px',
          boxShadow: '0 0 8px rgba(255,224,130,0.5)',
        }}>
          <img src={logoSrc} alt="Logo" style={{
            width: '40px', height: '40px', objectFit: 'contain',
            filter: 'brightness(2.2) contrast(1.4) drop-shadow(0 0 3px #FFE082)',
          }} />
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: 'linear-gradient(90deg, #FFE082 0%, #E5B83B 50%, #FFE082 100%)',
        padding: '3px 8px',
        display: 'flex', alignItems: 'center', gap: '6px',
        minHeight: '20px',
      }}>
        <svg width="10" height="12" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0zm0 16.8A4.8 4.8 0 1 1 12 7.2a4.8 4.8 0 0 1 0 9.6z" fill={DARK_TEXT}/>
        </svg>
        <span style={{ fontSize: '8px', color: DARK_TEXT, fontWeight: 800, lineHeight: 1.25 }}>
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

  const VERIFY_BASE = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://kmlwj.com';
  const qrValue = card?.cardNumber
    ? `${VERIFY_BASE}/verify/zakat/${encodeURIComponent(card.cardNumber)}`
    : member?.memberNo
    ? `${VERIFY_BASE}/verify/member/${encodeURIComponent(member.memberNo)}`
    : null;

  return (
    <CardShell>
      {/* ── HEADER ── */}
      <div style={{
        position: 'relative', zIndex: 3, textAlign: 'center',
        padding: '4px 12px 3px',
        background: 'rgba(255, 224, 130, 0.12)',
        borderBottom: `2px solid ${BORDER}`,
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 900, color: LIGHT_CREAM,
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>
          BENEFICIARY INFORMATION
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
              ['Address',      address ? (address.length > 45 ? address.slice(0, 45) + '…' : address) : null],
              ['Contact',      mobile],
              ['Issuing Date', fmtDate(card?.issueDate)],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{
                  fontSize: '9.2px', color: SECONDARY_TEXT, fontWeight: 900,
                  minWidth: '72px', flexShrink: 0,
                }}>
                  {label}:
                </span>
                <span style={{ fontSize: '9.2px', color: PRIMARY_TEXT, fontWeight: 800, lineHeight: 1.25 }}>
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
                background: BADGE_BG,
                padding: '3px',
                borderRadius: '5px',
                width: '50px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                <QRCodeSVG
                  value={qrValue}
                  size={512}
                  bgColor={BADGE_BG}
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
              <span style={{ fontSize: '6px', color: SECONDARY_TEXT, fontWeight: 900, letterSpacing: '0.04em' }}>
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
                borderBottom: `1.5px solid ${BORDER}`,
                marginBottom: '2px', height: '10px',
              }} />
              <span style={{ fontSize: '8px', color: LIGHT_CREAM, fontWeight: 900, letterSpacing: '0.04em' }}>
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER strip ── */}
      <div style={{
        position: 'relative', zIndex: 3,
        background: 'linear-gradient(90deg, #FFE082 0%, #E5B83B 50%, #FFE082 100%)',
        padding: '3px 10px',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px',
      }}>
        <span style={{ fontSize: '8px', color: DARK_TEXT, fontWeight: 800 }}>
          <span style={{ fontWeight: 900 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '8px', color: DARK_TEXT, fontWeight: 800 }}>
          <span style={{ fontWeight: 900 }}>Web:</span> {ORG_WEBSITE}
        </span>
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
