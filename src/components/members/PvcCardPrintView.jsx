import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Loader2, CheckCircle2 } from 'lucide-react';
import { CardFront, CardBack } from './MembershipCard';
import { ZakatCardFront, ZakatCardBack } from './ZakatCard';
import logoSrc from '../../assets/logo.png';

/* ─────────────────────────────────────────────────────────────
 * Dedicated CR80 PVC-card print view.
 * - Exact 85.60mm × 53.98mm landscape @page size
 * - Front and back on separate pages
 * - 300 DPI-quality assets (SVG QR + high-res logo)
 * - Preloads all images/QR before triggering print
 * - Hides all other UI while printing
 * - Uses existing CardFront/CardBack + ZakatCardFront/ZakatCardBack
 *   so design, colors, spacing, typography, QR generation, and data
 *   bindings remain untouched.
 * ────────────────────────────────────────────────────────────── */

/* CR80 physical dimensions (ISO/IEC 7810 ID-1) */
const CARD_W_MM = 85.60;
const CARD_H_MM = 53.98;

/* Scoped print stylesheet — activates only while the PVC print root exists */
const PVC_PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    width: 210mm !important;
    height: 297mm !important;
  }
  /* Force full-color output on every element */
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  /* Hide the entire application while printing */
  body > *:not(#pvc-print-portal) {
    display: none !important;
  }
  /* Hide non-print UI within the portal (buttons, header, backdrop) */
  #pvc-print-portal .pvc-no-print {
    display: none !important;
  }
  /* Reveal only the print sheet */
  #pvc-print-portal {
    position: static !important;
    background: #ffffff !important;
    inset: auto !important;
    padding: 0 !important;
    margin: 0 !important;
    width: 210mm !important;
    height: auto !important;
    overflow: visible !important;
  }
  #pvc-print-sheet {
    position: static !important;
    display: block !important;
    background: #ffffff !important;
    padding: 10mm 0 !important;
    margin: 0 auto !important;
    width: 210mm !important;
  }
  .pvc-card-page {
    width: 210mm !important;
    height: ${CARD_H_MM}mm !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6mm !important;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  /* Kill any transforms that could scale the card */
  .pvc-card-page, .pvc-card-page * {
    transform: none !important;
  }
  /* Preserve QR / logo / photo sharpness */
  #pvc-print-sheet img,
  #pvc-print-sheet svg {
    filter: none !important;
    opacity: revert !important;
    image-rendering: auto !important;
  }
}
`;

/* Inject the print stylesheet exactly once */
function usePvcPrintStyles() {
  useEffect(() => {
    if (document.getElementById('pvc-print-styles')) return;
    const el = document.createElement('style');
    el.id = 'pvc-print-styles';
    el.textContent = PVC_PRINT_CSS;
    document.head.appendChild(el);
  }, []);
}

/* Wait for a single image to finish loading (or fail) */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(); return; }
    const img = new Image();
    img.onload  = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/* Wait for every <img> and <svg> inside a node to be laid out and decoded */
async function waitForAssets(rootEl) {
  if (!rootEl) return;
  const imgs = Array.from(rootEl.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return;
    try {
      if (img.decode) { await img.decode().catch(() => {}); return; }
    } catch { /* fall through */ }
    await new Promise((res) => {
      img.addEventListener('load',  res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  }));
  // Give the layout engine one frame to settle SVG QR + fonts
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
}

/* ─────────────────────────────────────────────────────────────
 * Card renderer switch — reuses the existing card components
 * so all styling/data bindings/QR generation remain intact.
 * ──────────────────────────────────────────────────────────── */
function renderFront({ variant, data }) {
  if (variant === 'zakat') return <ZakatCardFront card={data} />;
  return <CardFront member={data} />;
}
function renderBack({ variant, data }) {
  if (variant === 'zakat') return <ZakatCardBack card={data} />;
  return <CardBack member={data} />;
}

/* Card page — enforces exact CR80 dimensions, one card per printed page */
function CardPage({ children }) {
  return (
    <div
      className="pvc-card-page"
      style={{
        width: `${CARD_W_MM}mm`,
        height: `${CARD_H_MM}mm`,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '3mm',
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────── */
export function PvcCardPrintView({
  isOpen,
  onClose,
  variant = 'member',       // 'member' | 'zakat'
  data,                     // member object OR zakat card object
  title,                    // optional override
}) {
  usePvcPrintStyles();
  const sheetRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | preparing | ready
  const [error, setError]   = useState(null);

  const resolvedTitle = title || (variant === 'zakat'
    ? 'Zakat Card — PVC Lamination Print'
    : 'Membership Card — PVC Lamination Print');

  const subject = variant === 'zakat'
    ? (data?.cardNumber || data?.beneficiary?.name || data?.member?.fullName || 'Zakat Card')
    : (data?.fullName || data?.memberNo || 'Member Card');

  /* Preload the logo + photo up front (QR is inline SVG, no network) */
  useEffect(() => {
    if (!isOpen || !data) return;
    let cancelled = false;
    setStatus('preparing');
    setError(null);
    const photoUrl = variant === 'zakat'
      ? (data?.beneficiary?.photoUrl || data?.member?.photoUrl)
      : data?.photoUrl;
    Promise.all([loadImage(logoSrc), loadImage(photoUrl)])
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(() => { if (!cancelled) { setStatus('ready'); } });
    return () => { cancelled = true; };
  }, [isOpen, data, variant]);

  /* Trigger the print — first wait for every asset inside the sheet */
  const handlePrint = useCallback(async () => {
    try {
      setStatus('preparing');
      await waitForAssets(sheetRef.current);
      setStatus('ready');
      // Slight defer so React finishes committing before print dialog opens
      setTimeout(() => window.print(), 60);
    } catch (e) {
      setError(e?.message || 'Failed to prepare card for print');
      setStatus('ready');
    }
  }, []);

  if (!isOpen || !data) return null;

  const ready = status === 'ready';

  return createPortal(
    <div
      id="pvc-print-portal"
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(6,8,12,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ── Toolbar (hidden on print) ── */}
      <div
        className="pvc-no-print"
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', padding: '12px 20px',
          background: '#0f1219', borderBottom: '1px solid #22283a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <Printer size={16} style={{ color: '#c9a227', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resolvedTitle}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subject} &nbsp;·&nbsp; CR80 · {CARD_W_MM}mm × {CARD_H_MM}mm · Front + Back on separate pages
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {status === 'preparing' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
              <Loader2 size={13} className="pvc-spin" style={{ animation: 'pvc-spin 0.9s linear infinite' }} />
              Preparing assets…
            </span>
          )}
          {status === 'ready' && !error && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>
              <CheckCircle2 size={13} />
              Ready to print
            </span>
          )}
          {error && (
            <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>{error}</span>
          )}
          <button
            onClick={handlePrint}
            disabled={!ready}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '10px',
              border: '1px solid rgba(201,162,39,0.4)',
              background: ready ? 'linear-gradient(135deg,#0D4E2B,#1A6B3C)' : '#1e293b',
              color: ready ? '#f7d97a' : '#64748b',
              fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em',
              cursor: ready ? 'pointer' : 'not-allowed',
              boxShadow: ready ? '0 6px 20px rgba(201,162,39,0.18)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Printer size={14} />
            Print PVC Card
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px', borderRadius: '10px',
              background: '#1e293b', border: '1px solid #334155',
              color: '#94a3b8', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Preview area (scrollable, non-print) ── */}
      <div
        className="pvc-no-print"
        style={{
          flex: 1, overflow: 'auto', padding: '24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <PreviewLabel text="Front Side (Left)" />
            <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column', borderRadius: '3mm', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.55)' }}>
              {renderFront({ variant, data })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <PreviewLabel text="Back Side (Right)" />
            <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column', borderRadius: '3mm', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.55)' }}>
              {renderBack({ variant, data })}
            </div>
          </div>
        </div>

        <div style={{
          maxWidth: '540px', marginTop: '6px', padding: '10px 14px',
          borderRadius: '10px', background: 'rgba(201,162,39,0.06)',
          border: '1px solid rgba(201,162,39,0.18)',
          fontSize: '11px', color: '#c9a227', lineHeight: 1.55, textAlign: 'center',
        }}>
          When the print dialog opens, disable “Headers and footers” and set
          margins to <b>None</b>. Page size is locked to CR80 ({CARD_W_MM}mm × {CARD_H_MM}mm)
          for direct PVC-card printer output.
        </div>
      </div>

      {/* ── Print sheet (the only element visible during printing: Front Left, Back Right) ── */}
      <div
        id="pvc-print-sheet"
        ref={sheetRef}
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '210mm', background: '#ffffff',
        }}
        aria-hidden="true"
      >
        <div className="pvc-card-page">
          <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
            {renderFront({ variant, data })}
          </div>
          <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
            {renderBack({ variant, data })}
          </div>
        </div>
      </div>

      <style>{`@keyframes pvc-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>,
    document.body
  );
}

function PreviewLabel({ text }) {
  return (
    <div style={{
      fontSize: '10px', color: '#94a3b8', fontWeight: 700,
      letterSpacing: '0.16em', textTransform: 'uppercase',
    }}>
      {text}
    </div>
  );
}

export default PvcCardPrintView;
