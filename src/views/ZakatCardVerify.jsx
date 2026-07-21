import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import logoSrc from '../assets/logo.png';

const GREEN_DARK  = '#0D4E2B';
const GREEN_MID   = '#1A6B3C';
const GREEN_LIGHT = '#4ade80';
const GOLD        = '#C9A227';
const WHITE       = '#FFFFFF';

const ORG_NAME  = 'Kutchi Muslim Loharwada Welfare Jamat';
const ORG_SHORT = 'KMLWJ';
const ORG_REGD  = 'Regd. 1319';

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtAmount(v) {
  if (v == null) return '—';
  return `Rs ${Number(v).toLocaleString('en-PK')}`;
}

export default function ZakatCardVerify() {
  const { cardNumber } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/zakat-card/verify/${encodeURIComponent(cardNumber)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.verified) {
          setError(data.error || 'Verification failed');
        } else {
          setResult(data);
        }
      } catch (e) {
        if (!cancelled) setError('Network error — could not reach verification service');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cardNumber]);

  const pageBg = {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg, #050f08 0%, #071a0e 50%, #050f08 100%)',
    fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
    color: WHITE,
    padding: '24px 16px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const cardBox = {
    width: '100%',
    maxWidth: '440px',
    background: 'rgba(13,78,43,0.35)',
    border: `1px solid ${GOLD}55`,
    borderRadius: '18px',
    padding: '24px 22px',
    marginTop: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  const row = (label, value) => (
    <div style={{
      display: 'flex', gap: '12px', padding: '10px 0',
      borderBottom: 'dashed 1px rgba(201,162,39,0.18)',
      alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', color: GOLD, fontWeight: 700, minWidth: '120px', letterSpacing: '0.03em' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: WHITE, fontWeight: 600, wordBreak: 'break-word' }}>
        {value ?? '—'}
      </span>
    </div>
  );

  return (
    <div style={pageBg}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '440px' }}>
        <img src={logoSrc} alt="KMLWJ" style={{ width: '68px', height: '68px', marginBottom: '10px' }} />
        <div style={{ fontSize: '18px', fontWeight: 800, color: GOLD, letterSpacing: '0.05em' }}>{ORG_SHORT}</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{ORG_NAME}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px', letterSpacing: '0.08em' }}>{ORG_REGD}</div>
      </div>

      {/* Body */}
      {loading && (
        <div style={cardBox}>
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.7)' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: `3px solid ${GOLD}55`, borderTopColor: GOLD,
              margin: '0 auto 14px', animation: 'spin 0.9s linear infinite',
            }} />
            Verifying zakat card…
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ ...cardBox, borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(127,29,29,0.25)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '54px', height: '54px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.5)',
              margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', color: '#f87171', fontWeight: 800,
            }}>✕</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>Verification Failed</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '8px', lineHeight: 1.5 }}>{error}</div>
          </div>
        </div>
      )}

      {!loading && result && (
        <div style={cardBox}>
          {/* Status pill */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '999px',
              background: result.status === 'VALID' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${result.status === 'VALID' ? 'rgba(74,222,128,0.45)' : 'rgba(239,68,68,0.45)'}`,
              color: result.status === 'VALID' ? GREEN_LIGHT : '#f87171',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
            }}>
              {result.status === 'VALID' ? '✓ VALID' : `✕ ${result.status}`}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: GOLD, fontWeight: 700, letterSpacing: '0.14em', textAlign: 'center', marginBottom: '4px', textTransform: 'uppercase' }}>
            Zakat Card Verification
          </div>

          <div style={{ marginTop: '14px' }}>
            {row('Zakat Card No', result.card.cardNumber)}
            {row('Member Name', result.card.holderName)}
            {result.card.fatherName && row("Father's Name", result.card.fatherName)}
            {row('CNIC', result.card.cnic)}
            {row('Issue Date', fmtDate(result.card.issueDate))}
            {row('Zakat Amount', fmtAmount(result.card.zakatAmount))}
            {result.card.gham && row('Ghaam', result.card.gham)}
            {result.card.area && row('Area', result.card.area)}
            {result.card.memberNo && row('Member No', result.card.memberNo)}
            {row('Status', result.status)}
          </div>

          <div style={{ marginTop: '18px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: '0.05em' }}>
            Verified at {new Date(result.verifiedAt).toLocaleString('en-PK')}
          </div>
        </div>
      )}
    </div>
  );
}
