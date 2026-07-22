import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import logoSrc from '../assets/logo.png';

/* ── Palette (matches the membership card branding) ── */
const GREEN_DARK  = '#0D4E2B';
const GREEN_MID   = '#1A6B3C';
const GREEN_LIGHT = '#4ade80';
const GOLD        = '#C9A227';
const GOLD_DARK   = '#A07E1B';
const WHITE       = '#FFFFFF';

const ORG_NAME     = 'Kutchi Muslim Loharwada Welfare Jamat';
const ORG_SHORT    = 'KMLWJ';
const ORG_REGD     = 'Regd. 1319';
const ORG_WEBSITE  = 'www.kmlwj.org';

/* ──────────── helpers ──────────── */
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  });
}

/* ──────────── Spinner ──────────── */
function Spinner() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #050f08 0%, #071a0e 50%, #050f08 100%)',
      fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
    }}>
      {/* Pulse logo */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(13,78,43,0.4), transparent)`,
          position: 'absolute', inset: '-16px',
          animation: 'ping 1.5s ease-in-out infinite'
        }} />
        <img src={logoSrc} alt={ORG_SHORT} style={{
          width: '80px', height: '80px', objectFit: 'contain',
          filter: 'drop-shadow(0 0 12px rgba(201,162,39,0.4))'
        }} />
      </div>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: `3px solid rgba(201,162,39,0.2)`,
        borderTopColor: GOLD,
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '20px', letterSpacing: '0.08em' }}>
        Verifying membership…
      </p>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes scaleIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes checkDraw { from{stroke-dashoffset:60} to{stroke-dashoffset:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(74,222,128,0.3)} 50%{box-shadow:0 0 40px rgba(74,222,128,0.6)} }
        @keyframes badgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes scanLine {
          0%  { top: 0%; opacity:1 }
          90% { top: 100%; opacity:1 }
          100%{ top: 100%; opacity:0 }
        }
      `}</style>
    </div>
  );
}

/* ──────────── Invalid Card ──────────── */
function InvalidCard() {
  return (
    <PublicShell>
      <div style={{
        textAlign: 'center', animation: 'fadeUp 0.5s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
      }}>
        {/* X icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          border: '2px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <line x1="12" y1="12" x2="28" y2="28" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
            <line x1="28" y1="12" x2="12" y2="28" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>

        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: WHITE, margin: 0 }}>Invalid Membership Card</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', lineHeight: 1.6, maxWidth: '320px' }}>
            This QR code does not belong to our organization or may have been tampered with.
          </p>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '12px', padding: '16px 20px', textAlign: 'left', width: '100%', maxWidth: '360px'
        }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>
            If you believe this is an error, please contact the {ORG_NAME} administration directly.
            Do not accept this card as valid until verified by our office.
          </p>
        </div>

        <OrgFooter />
      </div>
    </PublicShell>
  );
}

/* ──────────── Suspended / Inactive ──────────── */
function SuspendedCard({ member, verifiedAt }) {
  return (
    <PublicShell>
      <div style={{ animation: 'fadeUp 0.5s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        {/* Warning icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)',
          border: '2px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M20 14v9M20 26.5v1" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
            <path d="M17.3 7.5L4.7 29a3 3 0 002.6 4.5h25.4a3 3 0 002.6-4.5L22.7 7.5a3 3 0 00-5.4 0z" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round"/>
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '999px', padding: '4px 16px', marginBottom: '10px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Membership Suspended
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: WHITE, margin: 0 }}>
            {member.fullName}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
            Member No. {member.memberNo || '—'}
          </p>
        </div>

        <MemberPhotoCircle member={member} borderColor="rgba(245,158,11,0.5)" />

        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '12px', padding: '16px 20px', width: '100%', maxWidth: '360px'
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0, textAlign: 'center' }}>
            This membership has been <strong style={{ color: '#f59e0b' }}>suspended or expired</strong>.
            Please contact the {ORG_SHORT} office for reinstatement.
          </p>
        </div>

        <VerificationTimestamp verifiedAt={verifiedAt} />
        <OrgFooter />
      </div>
    </PublicShell>
  );
}

/* ──────────── ✓ Verified Member ──────────── */
function VerifiedCard({ member, verifiedAt }) {
  const jamie = member.ghamName || member.area || member.city || '—';

  return (
    <PublicShell>
      <div style={{ animation: 'fadeUp 0.5s ease', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>

        {/* ── GREEN VERIFIED HEADER BADGE ── */}
        <div style={{
          width: '100%', maxWidth: '400px',
          background: 'linear-gradient(135deg, rgba(13,78,43,0.9), rgba(26,107,60,0.8))',
          border: '1px solid rgba(74,222,128,0.25)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 20px',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          animation: 'glow 2.5s ease-in-out infinite'
        }}>
          {/* Subtle diagonal lines */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '14px 14px'
          }} />

          {/* Animated checkmark */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(74,222,128,0.15)',
            border: '2.5px solid rgba(74,222,128,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative', zIndex: 1
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 16.5L13.5 22L24 11"
                stroke={GREEN_LIGHT}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset="0"
                style={{ animation: 'checkDraw 0.6s ease 0.3s both' }}
              />
            </svg>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: GREEN_LIGHT, marginBottom: '4px'
            }}>
              ✓ Verified Member
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: WHITE, margin: 0, lineHeight: 1.2 }}>
              {member.fullName}
            </h1>
            {member.fatherName && (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '5px 0 0' }}>
                s/o {member.fatherName}
              </p>
            )}
          </div>
        </div>

        {/* ── CARD BODY ── */}
        <div style={{
          width: '100%', maxWidth: '400px',
          background: '#0d1a12',
          border: '1px solid rgba(74,222,128,0.12)',
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          padding: '0 24px 28px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
        }}>

          {/* Photo */}
          <div style={{ marginTop: '-1px', paddingTop: '20px' }}>
            <MemberPhotoCircle member={member} borderColor={`rgba(74,222,128,0.6)`} glowColor="rgba(74,222,128,0.2)" />
          </div>

          {/* Member No badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.3)',
            borderRadius: '999px', padding: '5px 16px',
            animation: 'badgePulse 2s ease-in-out infinite'
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill={GOLD}>
              <path d="M6 1L7.5 4.3 11 4.8 8.5 7.2 9.1 10.7 6 9 2.9 10.7 3.5 7.2 1 4.8 4.5 4.3z"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 700, color: GOLD, letterSpacing: '0.05em' }}>
              {member.memberNo || 'No ID Assigned'}
            </span>
          </div>

          {/* Detail rows */}
          <div style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px', overflow: 'hidden'
          }}>
            {[
              { icon: '🪪', label: 'CNIC',          value: member.cnic || '—' },
              { icon: '🕌', label: 'Jamaat / Area',  value: jamie },
              { icon: '🗓️', label: 'Issue Date',     value: fmtDate(member.doi) },
            ].map(({ icon, label, value }, i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>{icon}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {label}
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, textAlign: 'right', maxWidth: '180px' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Active status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: '10px', padding: '10px 20px'
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: GREEN_LIGHT,
              boxShadow: `0 0 8px ${GREEN_LIGHT}`,
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: GREEN_LIGHT }}>Membership Active</span>
          </div>

          {/* Verification timestamp */}
          <VerificationTimestamp verifiedAt={verifiedAt} />
        </div>

        <OrgFooter />
      </div>
    </PublicShell>
  );
}

/* ──────────── Sub-components ──────────── */
function MemberPhotoCircle({ member, borderColor, glowColor }) {
  const initials = (member.fullName || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden',
      border: `3px solid ${borderColor || 'rgba(201,162,39,0.5)'}`,
      boxShadow: glowColor ? `0 0 24px ${glowColor}` : 'none',
      background: `linear-gradient(135deg, ${GREEN_DARK}, #0A3D21)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both'
    }}>
      {member.photoUrl
        ? <img src={member.photoUrl} alt={member.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: GOLD, fontWeight: 800, fontSize: '28px' }}>{initials}</span>
      }
    </div>
  );
}

function VerificationTimestamp({ verifiedAt }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '7px',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px', padding: '10px 16px', width: '100%', maxWidth: '360px',
      justifyContent: 'center'
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
        <path d="M7 4v3.5l2 1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
        Verified at {fmtDateTime(verifiedAt)}
      </span>
    </div>
  );
}

function OrgFooter() {
  return (
    <div style={{
      textAlign: 'center', marginTop: '24px', padding: '0 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
    }}>
      <img src={logoSrc} alt={ORG_SHORT} style={{
        width: '36px', height: '36px', objectFit: 'contain', opacity: 0.6
      }} />
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>{ORG_NAME}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{ORG_REGD} • {ORG_WEBSITE}</div>
      </div>
      <div style={{
        fontSize: '10px', color: 'rgba(255,255,255,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '10px', marginTop: '4px', width: '100%', maxWidth: '300px'
      }}>
        This is an official digital verification page. Do not share this page link publicly.
      </div>
    </div>
  );
}

/* ──────────── Shell (dark background, centered) ──────────── */
function PublicShell({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #050f08 0%, #071a0e 50%, #050f08 100%)',
      fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 16px 48px',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(13,78,43,0.25) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
      }}>
        <div style={{ position: 'relative' }}>
          {/* Scanning line animation over logo */}
          <div style={{
            position: 'absolute', left: 0, right: 0, overflow: 'hidden',
            top: 0, bottom: 0, borderRadius: '12px', pointerEvents: 'none'
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.8), transparent)',
              animation: 'scanLine 2s ease-in-out infinite'
            }} />
          </div>
          <img src={logoSrc} alt={ORG_SHORT} style={{
            width: '56px', height: '56px', objectFit: 'contain',
            filter: 'drop-shadow(0 0 8px rgba(201,162,39,0.3))'
          }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {ORG_NAME}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '0.06em' }}>
            Member Verification Portal — {ORG_REGD}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes scaleIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes checkDraw { from{stroke-dashoffset:60} to{stroke-dashoffset:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(74,222,128,0.15)} 50%{box-shadow:0 0 40px rgba(74,222,128,0.3)} }
        @keyframes badgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes scanLine {
          0%  { top: 0%; opacity:1 }
          90% { top: 100%; opacity:1 }
          100%{ top: 100%; opacity:0 }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════ MAIN VIEW ═══════════════════════ */
export const MemberVerify = () => {
  const { id } = useParams();
  const [state, setState] = useState('loading'); // loading | verified | inactive | invalid | error
  const [data, setData] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (!id || id.trim().length < 2) {
      setState('invalid');
      return;
    }

    fetch(`/api/v1/member/verify/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.verified) {
          if (json.status === 'NOT_FOUND' || json.error?.includes('No member found')) {
            setState('invalid');
          } else {
            setState('error');
          }
          return;
        }
        setData({ member: json.member, verifiedAt: json.verifiedAt });
        setState(json.status === 'ACTIVE' ? 'verified' : 'inactive');
      })
      .catch(() => setState('error'));
  }, [id]);

  if (state === 'loading') return <Spinner />;
  if (state === 'invalid' || state === 'error') return <InvalidCard />;
  if (state === 'inactive') return <SuspendedCard member={data.member} verifiedAt={data.verifiedAt} />;
  return <VerifiedCard member={data.member} verifiedAt={data.verifiedAt} />;
};
