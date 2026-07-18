import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_LINE1    = 'KUTCHI MUSLIM LOHARWADA';
const ORG_LINE2    = 'WELFARE JAMAT';
const ORG_REGD     = '(REGD. 1319)';
const ORG_EMAIL    = 'info@kmlwj.org';
const ORG_WEBSITE  = 'www.kmlwj.org';

const GREEN      = '#0D4E2B';
const GREEN_MID  = '#1A6B3C';
const GOLD       = '#C9A227';
const GOLD_DARK  = '#A07E1B';
const GOLD_LIGHT = '#D4B03A';
const WHITE      = '#FFFFFF';
const CREAM      = '#F5F0E0';

function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtAmount(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString('en-PK');
}

export function ZakatCardFront({ card }) {
  const member = card?.member || {};
  const BASE_URL = 'https://kmlwj.com/member/verify';
  const qrValue = member?.memberNo
    ? `${BASE_URL}/${member.memberNo}`
    : member?.id
    ? `${BASE_URL}/${member.id}`
    : 'https://kmlwj.com';

  return (
    <div className="zakat-card-front" style={{
      position: 'relative',
      overflow: 'hidden',
      border: `1.5px solid ${GOLD_DARK}`,
      borderRadius: 'inherit',
    }}>
      {/* Gold left vertical bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
        background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD_DARK}, ${GOLD_LIGHT})`,
        zIndex: 4,
      }} />

      {/* Faint diagonal watermark */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.03,
        backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
        backgroundSize: '18px 18px',
      }} />

      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_MID} 100%)`,
        borderBottom: `2px solid ${GOLD}`,
        padding: '7px 10px 6px 14px',
        position: 'relative', zIndex: 3,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '8px', fontWeight: 800, color: CREAM,
            letterSpacing: '0.07em', lineHeight: 1.25, textTransform: 'uppercase',
          }}>
            {ORG_LINE1}
          </div>
          <div style={{
            fontSize: '8px', fontWeight: 800, color: CREAM,
            letterSpacing: '0.07em', lineHeight: 1.25, textTransform: 'uppercase',
          }}>
            {ORG_LINE2}
          </div>
          <div style={{
            fontSize: '6px', color: 'rgba(245,240,224,0.75)',
            letterSpacing: '0.04em', marginTop: '1px', lineHeight: 1.3,
          }}>
            {ORG_REGD}
          </div>
          <div style={{
            fontSize: '8px', fontWeight: 800, color: GOLD,
            letterSpacing: '0.12em', marginTop: '3px', textTransform: 'uppercase',
          }}>
            ZAKAT CARD
          </div>
        </div>

        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: `1.5px solid ${GOLD_DARK}`,
          background: `radial-gradient(circle, ${GREEN_MID}, ${GREEN})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
          boxShadow: `0 1px 6px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(201,162,39,0.2)`,
        }}>
          <img src={logoSrc} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* BODY */}
      <div style={{
        background: `linear-gradient(180deg, ${GREEN} 0%, #0A3D21 100%)`,
        padding: '7px 8px 6px 14px',
        display: 'flex', gap: '8px', flex: 1,
        position: 'relative', zIndex: 3,
        alignItems: 'flex-start',
      }}>
        {/* Member details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '2px' }}>
          {[
            ['Name',          member?.fullName],
            ['S/O',           member?.fatherName],
            ['Area / Jamaat', member?.area || member?.ghamName],
            ['Zakat Amount',  `Rs ${fmtAmount(card?.zakatAmount)}`],
            ['Issue Date',    fmtDate(card?.issueDate)],
            ['Card No',       card?.cardNumber],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{
                fontSize: '6.5px', color: GOLD, fontWeight: 700,
                minWidth: '62px', flexShrink: 0, letterSpacing: '0.01em',
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

        {/* QR code */}
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <div style={{
            background: WHITE, padding: '3px', borderRadius: '3px',
            border: `1.5px solid ${GOLD}`,
            boxShadow: `0 1px 4px rgba(0,0,0,0.3)`,
          }}>
            <QRCodeSVG value={qrValue} size={48} bgColor={WHITE} fgColor="#000000" level="M" />
          </div>
        </div>
      </div>

      {/* FOOTER — Signature lines */}
      <div style={{
        background: `linear-gradient(180deg, #0A3D21 0%, ${GREEN} 100%)`,
        padding: '4px 14px 6px',
        position: 'relative', zIndex: 3,
        borderTop: `1px solid ${GOLD}44`,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        {['Chairman', 'President'].map(title => (
          <div key={title} style={{ textAlign: 'center', minWidth: '72px' }}>
            <div style={{
              borderBottom: `1px solid ${GOLD}88`,
              marginBottom: '3px', height: '14px',
            }} />
            <span style={{
              fontSize: '6px', color: GOLD, fontWeight: 600, letterSpacing: '0.05em',
            }}>
              {title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ZakatCardBack({ card }) {
  const member = card?.member || {};

  return (
    <div className="zakat-card-back" style={{
      position: 'relative',
      overflow: 'hidden',
      border: `1.5px solid ${GOLD_DARK}`,
      borderRadius: 'inherit',
    }}>
      {/* Gold left vertical bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
        background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD_DARK}, ${GOLD_LIGHT})`,
        zIndex: 4,
      }} />

      {/* Faded emblem watermark */}
      <div style={{
        position: 'absolute', right: '-10px', bottom: '-10px',
        width: '100px', height: '100px', opacity: 0.06, zIndex: 1,
      }}>
        <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_MID} 100%)`,
        borderBottom: `2px solid ${GOLD}`,
        padding: '8px 12px 7px 14px',
        position: 'relative', zIndex: 3, textAlign: 'center',
      }}>
        <div style={{
          fontSize: '8.5px', fontWeight: 800, color: GOLD,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          ZAKAT DISBURSEMENT DETAILS
        </div>
      </div>

      {/* BODY */}
      <div style={{
        background: `linear-gradient(180deg, ${GREEN} 0%, #0A3D21 100%)`,
        padding: '9px 14px 6px 16px',
        flex: 1, position: 'relative', zIndex: 3,
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        {[
          ['Member No',  member?.memberNo],
          ['CNIC',       member?.cnic],
          ['Ghaam',      member?.ghamName],
          ['Contact',    member?.mobile],
          ['Address',    member?.address ? (member.address.length > 35 ? member.address.slice(0, 35) + '…' : member.address) : null],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{
              fontSize: '6.5px', color: GOLD, fontWeight: 700,
              minWidth: '62px', flexShrink: 0, letterSpacing: '0.01em',
            }}>
              {label}:
            </span>
            <span style={{ fontSize: '7px', color: WHITE, fontWeight: 500, lineHeight: 1.3 }}>
              {fmt(value)}
            </span>
          </div>
        ))}

        {/* Zakat amount highlight */}
        <div style={{
          marginTop: '4px', padding: '4px 8px', borderRadius: '4px',
          background: 'rgba(201,162,39,0.12)', border: `1px solid ${GOLD}44`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '7px', color: GOLD, fontWeight: 700 }}>ZAKAT AMOUNT</span>
          <span style={{ fontSize: '9px', color: WHITE, fontWeight: 800 }}>Rs {fmtAmount(card?.zakatAmount)}</span>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        background: CREAM,
        padding: '3px 10px 3px 14px',
        position: 'relative', zIndex: 3,
        borderTop: `1px solid ${GOLD}33`,
        display: 'flex', flexWrap: 'wrap', gap: '10px',
      }}>
        <span style={{ fontSize: '5.8px', color: '#3A5C40' }}>
          <span style={{ fontWeight: 700 }}>Email:</span> {ORG_EMAIL}
        </span>
        <span style={{ fontSize: '5.8px', color: '#3A5C40' }}>
          <span style={{ fontWeight: 700 }}>Web:</span> {ORG_WEBSITE}
        </span>
      </div>
    </div>
  );
}
