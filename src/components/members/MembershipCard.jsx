import React, { useRef, useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSrc from '../../assets/logo.png';

const ORG_NAME = 'KUTCHI MUSLIM LOHARWADA WELFARE JAMAT';
const ORG_REGD = '(REGD. 1319)';
const ORG_RETURN_ADDR = 'Jumma Baloch Road, New Kalri, Lyari, Karachi';
const ORG_EMAIL = 'info@kmlwj.org';
const ORG_WEBSITE = 'www.kmlwj.org';

/* ── Palette ── */
const GREEN = '#0D4E2B';
const GREEN_LIGHT = '#1A6B3C';
const GOLD = '#C9A227';
const GOLD_DARK = '#A07E1B';
const WHITE = '#FFFFFF';
const CREAM = '#F5F0E0';

/* ── Helper ── */
function fmt(val) { return val || '—'; }
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    <div className="id-card-front" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* Gold vertical accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '7px',
        background: `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`,
        zIndex: 2
      }} />

      {/* Watermark emblem */}
      <div style={{
        position: 'absolute', right: '-18px', bottom: '-18px',
        width: '110px', height: '110px', opacity: 0.06, zIndex: 1
      }}>
        <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_LIGHT} 100%)`,
        padding: '9px 10px 8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `2px solid ${GOLD}`,
        position: 'relative', zIndex: 3
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logoSrc} alt="Logo"
            style={{ width: '38px', height: '38px', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
          <div>
            <div style={{ fontSize: '7.5px', fontWeight: 800, color: GOLD, letterSpacing: '0.06em', lineHeight: 1.3, textTransform: 'uppercase' }}>
              {ORG_NAME}
            </div>
            <div style={{ fontSize: '6px', color: CREAM, letterSpacing: '0.04em', lineHeight: 1.4 }}>{ORG_REGD}</div>
            <div style={{ fontSize: '7px', fontWeight: 700, color: GOLD, letterSpacing: '0.12em', marginTop: '2px' }}>MEMBERSHIP CARD</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        background: `linear-gradient(180deg, ${GREEN} 0%, #0A3D21 100%)`,
        padding: '8px 10px 8px 16px',
        display: 'flex', gap: '9px', flex: 1, position: 'relative', zIndex: 3
      }}>

        {/* Photo */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            width: '66px', height: '76px',
            border: `2.5px solid ${GOLD}`,
            borderRadius: '5px',
            overflow: 'hidden',
            background: CREAM,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 8px rgba(0,0,0,0.4)`
          }}>
            {member?.photoUrl
              ? <img src={member.photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <div style={{
                  width: '100%', height: '100%',
                  background: `linear-gradient(135deg, ${GREEN_LIGHT}, ${GREEN})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: GOLD, fontSize: '22px', fontWeight: 800
                }}>
                  {(member?.fullName || 'M')[0].toUpperCase()}
                </div>
              )
            }
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3.5px', paddingTop: '1px' }}>
          {[
            ['Membership No', member?.memberNo],
            ['Name', member?.fullName],
            ['F. Name', member?.fatherName],
            ['D.O.B', fmtDate(member?.dob)],
            ['CNIC', member?.cnic],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span style={{ fontSize: '6.5px', color: GOLD, fontWeight: 700, minWidth: '60px', flexShrink: 0 }}>{label}:</span>
              <span style={{ fontSize: '7px', color: WHITE, fontWeight: 600, lineHeight: 1.2, wordBreak: 'break-all' }}>{fmt(value)}</span>
            </div>
          ))}
        </div>

        {/* QR Code */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '1px' }}>
          <div style={{
            background: WHITE, padding: '3px', borderRadius: '4px',
            border: `1.5px solid ${GOLD}`,
            boxShadow: `0 1px 4px rgba(0,0,0,0.3)`
          }}>
            <QRCodeSVG
              value={qrValue}
              size={52}
              bgColor={WHITE}
              fgColor="#000000"
              level="M"
            />
          </div>
        </div>
      </div>

      {/* ── Return address footer ── */}
      <div style={{
        background: CREAM,
        padding: '4px 10px 4px 16px',
        display: 'flex', alignItems: 'center', gap: '5px',
        borderTop: `1px solid ${GOLD}33`,
        position: 'relative', zIndex: 3
      }}>
        <span style={{ fontSize: '7.5px', color: GREEN }}>📍</span>
        <span style={{ fontSize: '5.8px', color: '#2D5A3D', fontStyle: 'italic', lineHeight: 1.3 }}>
          If found please return to {ORG_NAME.split(' WELFARE')[0]} Welfare Jamat, {ORG_RETURN_ADDR}.
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────── BACK ─────────────────────────────────── */
export function CardBack({ member }) {
  return (
    <div className="id-card-back" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* Gold vertical accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '7px',
        background: `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`,
        zIndex: 2
      }} />

      {/* Watermark emblem */}
      <div style={{
        position: 'absolute', right: '-18px', bottom: '10px',
        width: '100px', height: '100px', opacity: 0.05, zIndex: 1
      }}>
        <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

      {/* ── Header: Member Information title ── */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_LIGHT} 100%)`,
        padding: '7px 12px 7px 16px',
        borderBottom: `2px solid ${GOLD}`,
        position: 'relative', zIndex: 3
      }}>
        <div style={{ fontSize: '8px', fontWeight: 800, color: GOLD, textAlign: 'center', letterSpacing: '0.15em' }}>
          MEMBER INFORMATION
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        background: `linear-gradient(180deg, ${GREEN} 0%, #0A3D21 100%)`,
        padding: '8px 14px 6px 16px',
        flex: 1, position: 'relative', zIndex: 3
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3.5px 16px' }}>
          {[
            ['Ghaam', member?.ghamName],
            ['Contact', member?.mobile],
            ['Address', member?.address ? (member.address.length > 30 ? member.address.slice(0, 30) + '…' : member.address) : null],
            ['Issuing Date', fmtDate(member?.doi)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px', gridColumn: label === 'Address' ? '1 / -1' : 'auto' }}>
              <span style={{ fontSize: '6px', color: GOLD, fontWeight: 700, letterSpacing: '0.04em' }}>{label}:</span>
              <span style={{ fontSize: '7px', color: WHITE, fontWeight: 500, lineHeight: 1.3 }}>{fmt(value)}</span>
            </div>
          ))}
        </div>

        {/* Signatures */}
        <div style={{
          marginTop: '10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          paddingTop: '6px', borderTop: `1px solid ${GOLD}44`
        }}>
          {['Chairman', 'President'].map(title => (
            <div key={title} style={{ textAlign: 'center', minWidth: '70px' }}>
              <div style={{ borderBottom: `1px solid ${GOLD}88`, marginBottom: '3px', height: '16px' }} />
              <span style={{ fontSize: '6px', color: GOLD, fontWeight: 600, letterSpacing: '0.05em' }}>{title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: CREAM,
        padding: '3px 10px 3px 16px',
        position: 'relative', zIndex: 3,
        borderTop: `1px solid ${GOLD}33`,
        display: 'flex', flexWrap: 'wrap', gap: '6px'
      }}>
        {[
          ['Email', ORG_EMAIL],
          ['Web', ORG_WEBSITE],
        ].map(([label, value]) => (
          <span key={label} style={{ fontSize: '5.8px', color: '#2D5A3D' }}>
            <span style={{ fontWeight: 700 }}>{label}:</span> {value}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────── Full Card (front + back preview) ────────────────────── */
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
