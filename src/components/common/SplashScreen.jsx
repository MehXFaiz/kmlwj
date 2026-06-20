import { useEffect, useState, useRef } from 'react';
import logoImg from '../../assets/logo.png';

/* ─────────────────────────────────────────────
   Particle Canvas
───────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId, t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLS = 32, ROWS = 20;
    const dots = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        dots.push({
          bx: (c / (COLS - 1)) * window.innerWidth,
          by: (r / (ROWS - 1)) * window.innerHeight,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.5,
          amp:   2   + Math.random() * 3,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.007;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      dots.forEach(d => {
        const x     = d.bx + Math.sin(t * d.speed + d.phase) * d.amp;
        const y     = d.by + Math.cos(t * d.speed + d.phase + 1.2) * d.amp;
        const dist  = Math.hypot(x - cx, y - cy);
        const maxD  = Math.hypot(cx, cy);
        const prox  = 1 - dist / maxD;
        const alpha = 0.03 + prox * 0.11 + Math.sin(t * 1.5 + d.phase) * 0.03;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${Math.max(0, alpha)})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

/* ─────────────────────────────────────────────
   Logo with spinning rings
───────────────────────────────────────────── */
function LogoRing({ visible }) {
  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(1) translateY(0)' : 'scale(0.65) translateY(28px)',
      transition: 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Outer dashed ring */}
      <div style={{
        position: 'absolute', width: 178, height: 178, borderRadius: '50%',
        border: '1px dashed rgba(99,102,241,0.2)',
        animation: 'sp-spin-slow 18s linear infinite',
      }}>
        {/* Dot markers on ring */}
        {[0, 90, 180, 270].map(deg => (
          <div key={deg} style={{
            position: 'absolute',
            width: 5, height: 5,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.6)',
            boxShadow: '0 0 6px rgba(99,102,241,0.7)',
            top: '50%', left: '50%',
            transform: `rotate(${deg}deg) translateX(86px) translateY(-50%)`,
          }} />
        ))}
      </div>

      {/* Outer spinning conic ring — indigo */}
      <div style={{
        position: 'absolute', width: 156, height: 156, borderRadius: '50%',
        background: 'conic-gradient(from 0deg, transparent 60%, rgba(99,102,241,0.9) 100%)',
        animation: 'sp-spin 2.6s linear infinite',
      }} />
      {/* Inner conic ring — blue */}
      <div style={{
        position: 'absolute', width: 132, height: 132, borderRadius: '50%',
        background: 'conic-gradient(from 180deg, transparent 65%, rgba(59,130,246,0.75) 100%)',
        animation: 'sp-spin-rev 3.8s linear infinite',
      }} />
      {/* Glow halo */}
      <div style={{
        position: 'absolute', width: 114, height: 114, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)',
        filter: 'blur(10px)',
        animation: 'sp-pulse 2.2s ease-in-out infinite',
      }} />
      {/* Glass disc */}
      <div style={{
        position: 'absolute', width: 118, height: 118, borderRadius: '50%',
        background: 'rgba(15,12,46,0.55)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(99,102,241,0.15)',
      }} />
      {/* Logo image */}
      <img src={logoImg} alt="KMLWJ Logo" style={{
        position: 'relative', zIndex: 10,
        width: 100, height: 100, objectFit: 'contain',
        filter: 'drop-shadow(0 0 18px rgba(99,102,241,0.55))',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Horizontal scan line
───────────────────────────────────────────── */
function ScanLine() {
  return (
    <div className="absolute inset-x-0 pointer-events-none overflow-hidden" style={{ top: 0, height: '100%' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.55) 35%, rgba(59,130,246,0.8) 50%, rgba(99,102,241,0.55) 65%, transparent 100%)',
        animation: 'sp-scan 4s ease-in-out infinite',
        boxShadow: '0 0 14px rgba(99,102,241,0.45)',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Loading steps
───────────────────────────────────────────── */
const STEPS = [
  { label: 'Initializing Core Engine',      duration: 470 },
  { label: 'Loading Chart of Accounts',     duration: 520 },
  { label: 'Hydrating General Ledger',      duration: 440 },
  { label: 'Syncing Journal Entries',       duration: 380 },
  { label: 'Verifying Audit Trail',         duration: 350 },
  { label: 'Applying Compliance Rules',     duration: 420 },
  { label: 'Establishing Secure Session',   duration: 310 },
  { label: 'System Ready',                  duration: 250 },
];

/* ─────────────────────────────────────────────
   Main Splash Screen
───────────────────────────────────────────── */
export function SplashScreen({ onComplete }) {
  const [logoVisible,  setLogoVisible]  = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [barVisible,   setBarVisible]   = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [stepIndex,    setStepIndex]    = useState(0);
  const [stepLabel,    setStepLabel]    = useState(STEPS[0].label);
  const [fadingOut,    setFadingOut]    = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true),  200);
    const t2 = setTimeout(() => setTitleVisible(true), 750);
    const t3 = setTimeout(() => setBarVisible(true),   1200);

    let cur = 0, curProg = 0, t4;
    const runStep = () => {
      if (cur >= STEPS.length) {
        setTimeout(() => { setFadingOut(true); setTimeout(() => onComplete?.(), 720); }, 300);
        return;
      }
      const step   = STEPS[cur];
      setStepLabel(step.label);
      setStepIndex(cur);
      const target = Math.round(((cur + 1) / STEPS.length) * 100);
      const incr   = (target - curProg) / (step.duration / 30);
      const tick   = () => {
        curProg = Math.min(curProg + incr, target);
        setProgress(Math.round(curProg));
        if (curProg < target) t4 = setTimeout(tick, 30);
        else { cur++; t4 = setTimeout(runStep, 80); }
      };
      tick();
    };
    const t5 = setTimeout(runStep, 1400);
    return () => { [t1,t2,t3,t4,t5].forEach(clearTimeout); };
  }, [onComplete]);

  return (
    <>
      {/* Google Font — Noto Nastaliq Urdu */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes sp-spin        { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes sp-spin-rev    { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
        @keyframes sp-spin-slow   { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes sp-pulse       { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes sp-scan        { 0%{top:-2px;opacity:0} 5%{opacity:1} 95%{opacity:1} 100%{top:100%;opacity:0} }
        @keyframes sp-blink       { 0%,100%{opacity:1} 50%{opacity:.12} }
        @keyframes sp-bar-glow    { 0%,100%{box-shadow:0 0 8px rgba(99,102,241,.55)} 50%{box-shadow:0 0 24px rgba(99,102,241,.9),0 0 48px rgba(59,130,246,.35)} }
        @keyframes sp-shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes sp-badge-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes sp-orb-drift   { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-55px) scale(1.06)} }
        @keyframes sp-line-grow   { from{width:0} to{width:100px} }
        @keyframes sp-fade-up     { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sp-grid-in     { from{opacity:0;transform:scaleX(0)} to{opacity:1;transform:scaleX(1)} }

        .sp-urdu {
          font-family: 'Noto Nastaliq Urdu', serif;
          direction: rtl;
          unicode-bidi: embed;
        }

        /* Animated grid lines for the background */
        .sp-grid-line-h {
          position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.07) 50%, transparent 100%);
        }
        .sp-grid-line-v {
          position: absolute; top: 0; bottom: 0; width: 1px;
          background: linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.07) 50%, transparent 100%);
        }
      `}</style>

      {/* Root overlay */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none"
        style={{
          background: 'radial-gradient(ellipse 85% 65% at 50% 38%, #0f0c2e 0%, #020617 58%, #000000 100%)',
          opacity:   fadingOut ? 0 : 1,
          transform: fadingOut ? 'scale(1.03)' : 'scale(1)',
          transition: 'opacity 0.68s ease, transform 0.68s ease',
          pointerEvents: fadingOut ? 'none' : 'all',
        }}
      >
        {/* Particles */}
        <ParticleCanvas />

        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[20, 40, 60, 80].map(pct => (
            <div key={pct} className="sp-grid-line-h" style={{ top: `${pct}%` }} />
          ))}
          {[20, 35, 50, 65, 80].map(pct => (
            <div key={pct} className="sp-grid-line-v" style={{ left: `${pct}%` }} />
          ))}
        </div>

        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position:'absolute', top:'6%', left:'8%',
            width:560, height:560, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(79,70,229,0.11) 0%, transparent 70%)',
            filter:'blur(50px)',
            animation:'sp-orb-drift 20s ease-in-out infinite alternate',
          }} />
          <div style={{
            position:'absolute', bottom:'6%', right:'8%',
            width:460, height:460, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%)',
            filter:'blur(55px)',
            animation:'sp-orb-drift 26s ease-in-out infinite alternate-reverse',
          }} />
          <div style={{
            position:'absolute', top:'42%', right:'18%',
            width:300, height:300, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
            filter:'blur(38px)',
          }} />
        </div>

        {/* Scan line */}
        <ScanLine />

        {/* ── Two-column layout: LEFT info + RIGHT logo ── */}
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          maxWidth: 860,
          padding: '0 40px',
        }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', gap: 0,
            paddingRight: 48,
          }}>
            {/* Status badge */}
            <div style={{
              marginBottom: 28,
              opacity: titleVisible ? 1 : 0,
              transition: 'opacity 0.7s ease 0.3s',
              animation: 'sp-badge-float 3.5s ease-in-out infinite',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 9999,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#a5b4fc',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.22)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#34d399', display: 'inline-block',
                  boxShadow: '0 0 6px rgba(52,211,153,0.8)',
                  animation: 'sp-blink 1.4s ease-in-out infinite',
                }} />
                Enterprise Suite · v2.0
              </span>
            </div>

            {/* English title */}
            <h1 style={{
              margin: 0,
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 45%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: titleVisible ? 1 : 0,
              transform: titleVisible ? 'translateY(0)' : 'translateY(22px)',
              transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s',
            }}>
              KMLWJ
            </h1>

            {/* Accent underline */}
            <div style={{
              marginTop: 10, marginBottom: 16,
              height: 3, borderRadius: 9999,
              width: titleVisible ? 100 : 0,
              background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
              boxShadow: '0 0 12px rgba(99,102,241,0.6)',
              transition: 'width 1s cubic-bezier(0.16,1,0.3,1) 0.5s',
            }} />

            {/* Urdu name */}
            <div className="sp-urdu" style={{
              fontSize: 'clamp(18px, 2.8vw, 26px)',
              fontWeight: 700,
              lineHeight: 1.8,
              background: 'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 60%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: titleVisible ? 1 : 0,
              transform: titleVisible ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s',
              textAlign: 'right',
              width: '100%',
            }}>
              کچھی مسلم لوہار واڈہ ویلفیئر جماعت
            </div>

            {/* Sub-tagline */}
            <p style={{
              marginTop: 16, marginBottom: 0,
              fontSize: 11.5, color: 'rgba(148,163,184,0.65)',
              letterSpacing: '0.06em', fontWeight: 400,
              lineHeight: 1.6,
              opacity: titleVisible ? 1 : 0,
              transition: 'opacity 0.8s ease 0.55s',
            }}>
              Chart of Accounts · General Ledger<br />
              Journal Engine · Audit Trail
            </p>

            {/* Module dots */}
            <div style={{
              display: 'flex', gap: 8, marginTop: 22,
              opacity: titleVisible ? 1 : 0,
              transition: 'opacity 0.7s ease 0.65s',
            }}>
              {['COA', 'GL', 'JE', 'AT'].map((tag, i) => (
                <span key={tag} style={{
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'rgba(165,180,252,0.7)',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.16)',
                  transition: `opacity 0.4s ease ${0.7 + i * 0.07}s`,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── VERTICAL DIVIDER ── */}
          <div style={{
            width: 1,
            alignSelf: 'stretch',
            background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.35) 30%, rgba(59,130,246,0.35) 70%, transparent)',
            opacity: barVisible ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }} />

          {/* ── RIGHT COLUMN ── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            paddingLeft: 48, gap: 0,
          }}>
            {/* Logo */}
            <LogoRing visible={logoVisible} />

            {/* Progress section */}
            <div style={{
              width: '100%', marginTop: 36,
              opacity: barVisible ? 1 : 0,
              transform: barVisible ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
            }}>
              {/* Label row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 9,
              }}>
                <span style={{
                  fontSize: 10.5, color: 'rgba(148,163,184,0.7)',
                  fontWeight: 500, letterSpacing: '0.03em',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: progress < 100 ? '#6366f1' : '#34d399',
                    animation: progress < 100 ? 'sp-blink 0.9s ease-in-out infinite' : 'none',
                    boxShadow: '0 0 7px rgba(99,102,241,0.8)',
                  }} />
                  {stepLabel}
                </span>
                <span style={{
                  fontSize: 11.5, fontWeight: 800,
                  color: progress < 100 ? '#818cf8' : '#34d399',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.01em',
                  transition: 'color 0.4s ease',
                }}>
                  {progress}%
                </span>
              </div>

              {/* Bar track */}
              <div style={{
                width: '100%', height: 4, borderRadius: 9999,
                background: 'rgba(15,12,46,0.9)',
                border: '1px solid rgba(99,102,241,0.12)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  borderRadius: 9999,
                  background: progress < 100
                    ? 'linear-gradient(90deg, #4338ca, #6366f1, #60a5fa)'
                    : 'linear-gradient(90deg, #059669, #34d399, #6ee7b7)',
                  transition: 'width 0.25s ease, background 0.5s ease',
                  animation: 'sp-bar-glow 2s ease-in-out infinite',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'sp-shimmer 1.8s linear infinite',
                  }} />
                </div>
              </div>

              {/* Step dots */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 12, paddingLeft: 1, paddingRight: 1,
              }}>
                {STEPS.map((s, i) => (
                  <div key={i} title={s.label} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    transition: 'background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease',
                    background: i < stepIndex
                      ? '#1e1b4b'
                      : i === stepIndex ? '#6366f1' : 'rgba(51,65,85,0.5)',
                    transform: i === stepIndex ? 'scale(1.7)' : 'scale(1)',
                    boxShadow: i === stepIndex ? '0 0 10px rgba(99,102,241,0.9)' : 'none',
                    border: i <= stepIndex ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(51,65,85,0.3)',
                  }} />
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p style={{
              marginTop: 26,
              fontSize: 9.5,
              color: 'rgba(100,116,139,0.55)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              fontWeight: 600,
              textAlign: 'center',
              opacity: barVisible ? 1 : 0,
              transition: 'opacity 0.6s ease 0.4s',
            }}>
              GAAP · SOX · Double-Entry
            </p>
          </div>
        </div>

        {/* Corner brackets */}
        {[
          { top: 22, left: 22 },
          { top: 22, right: 22 },
          { bottom: 22, left: 22 },
          { bottom: 22, right: 22 },
        ].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute', ...pos,
            width: 22, height: 22,
            borderColor: 'rgba(99,102,241,0.28)',
            borderStyle: 'solid', borderWidth: 0,
            ...(pos.top    !== undefined && pos.left  !== undefined ? { borderTopWidth: 1.5, borderLeftWidth:  1.5 }
              : pos.top    !== undefined && pos.right !== undefined ? { borderTopWidth: 1.5, borderRightWidth: 1.5 }
              : pos.bottom !== undefined && pos.left  !== undefined ? { borderBottomWidth: 1.5, borderLeftWidth:  1.5 }
              :                                                       { borderBottomWidth: 1.5, borderRightWidth: 1.5 }),
            opacity: barVisible ? 1 : 0,
            transition: `opacity 0.8s ease ${0.5 + i * 0.08}s`,
          }} />
        ))}

        {/* Bottom center watermark */}
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          textAlign: 'center',
          opacity: barVisible ? 1 : 0,
          transition: 'opacity 0.8s ease 0.6s',
        }}>
          <span style={{
            fontSize: 9,
            color: 'rgba(99,102,241,0.3)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            ◆ &nbsp; Kachhi Muslim Lohar Wada Welfare Jamaat &nbsp; ◆
          </span>
        </div>
      </div>
    </>
  );
}
