import { useEffect, useState, useRef } from 'react';
import logoImg from '../../assets/kmlwj_logo.png';

/* ─────────────────────────────────────────────
   Particle Canvas Background
───────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLS = 30;
    const ROWS = 20;
    const dots = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        dots.push({
          bx: (c / (COLS - 1)) * window.innerWidth,
          by: (r / (ROWS - 1)) * window.innerHeight,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.5,
          amp: 2 + Math.random() * 3,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.007;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      dots.forEach((d) => {
        const x = d.bx + Math.sin(t * d.speed + d.phase) * d.amp;
        const y = d.by + Math.cos(t * d.speed + d.phase + 1.2) * d.amp;
        const dist = Math.hypot(x - cx, y - cy);
        const maxDist = Math.hypot(cx, cy);
        const proximity = 1 - dist / maxDist;
        const alpha = 0.03 + proximity * 0.1 + Math.sin(t * 1.5 + d.phase) * 0.03;

        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,232,186,${Math.max(0, alpha)})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

/* ─────────────────────────────────────────────
   Animated Logo Ring
───────────────────────────────────────────── */
function LogoRing({ visible }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(24px)',
        transition: 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Outer rotating conic ring — emerald */}
      <div
        style={{
          position: 'absolute',
          width: 168,
          height: 168,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent 55%, rgba(16,185,129,0.85) 100%)',
          animation: 'sp-spin 2.8s linear infinite',
        }}
      />
      {/* Middle rotating ring — gold */}
      <div
        style={{
          position: 'absolute',
          width: 144,
          height: 144,
          borderRadius: '50%',
          background: 'conic-gradient(from 180deg, transparent 60%, rgba(245,158,11,0.7) 100%)',
          animation: 'sp-spin-rev 4s linear infinite',
        }}
      />
      {/* Inner glow halo */}
      <div
        style={{
          position: 'absolute',
          width: 122,
          height: 122,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)',
          filter: 'blur(10px)',
          animation: 'sp-pulse 2.5s ease-in-out infinite',
        }}
      />
      {/* Static border ring */}
      <div
        style={{
          position: 'absolute',
          width: 130,
          height: 130,
          borderRadius: '50%',
          border: '1px solid rgba(245,158,11,0.18)',
        }}
      />
      {/* Logo */}
      <img
        src={logoImg}
        alt="KMLWJ Logo"
        style={{
          position: 'relative',
          zIndex: 10,
          width: 112,
          height: 112,
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 18px rgba(16,185,129,0.45))',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Scanning line
───────────────────────────────────────────── */
function ScanLine() {
  return (
    <div className="absolute inset-x-0 pointer-events-none overflow-hidden" style={{ top: 0, height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.5) 40%, rgba(245,158,11,0.7) 50%, rgba(16,185,129,0.5) 60%, transparent 100%)',
          animation: 'sp-scan 4s ease-in-out infinite',
          boxShadow: '0 0 14px rgba(16,185,129,0.4)',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Loading steps
───────────────────────────────────────────── */
const STEPS = [
  { label: 'Initializing Core Engine',        duration: 460 },
  { label: 'Loading Chart of Accounts',       duration: 510 },
  { label: 'Hydrating General Ledger',        duration: 430 },
  { label: 'Syncing Journal Entries',         duration: 370 },
  { label: 'Verifying Audit Trail',           duration: 340 },
  { label: 'Applying Compliance Rules',       duration: 400 },
  { label: 'Establishing Secure Session',     duration: 300 },
  { label: 'System Ready',                    duration: 240 },
];

/* ─────────────────────────────────────────────
   Main Splash Screen
───────────────────────────────────────────── */
export function SplashScreen({ onComplete }) {
  const [logoVisible, setLogoVisible]   = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [barVisible, setBarVisible]     = useState(false);
  const [progress, setProgress]         = useState(0);
  const [stepIndex, setStepIndex]       = useState(0);
  const [stepLabel, setStepLabel]       = useState(STEPS[0].label);
  const [fadingOut, setFadingOut]       = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true),  200);
    const t2 = setTimeout(() => setTitleVisible(true), 750);
    const t3 = setTimeout(() => setBarVisible(true),   1200);

    let currentStep     = 0;
    let currentProgress = 0;
    let t4;

    const runStep = () => {
      if (currentStep >= STEPS.length) {
        setTimeout(() => {
          setFadingOut(true);
          setTimeout(() => onComplete?.(), 750);
        }, 300);
        return;
      }
      const step = STEPS[currentStep];
      setStepLabel(step.label);
      setStepIndex(currentStep);
      const targetProgress = Math.round(((currentStep + 1) / STEPS.length) * 100);
      const increment = (targetProgress - currentProgress) / (step.duration / 30);

      const tick = () => {
        currentProgress = Math.min(currentProgress + increment, targetProgress);
        setProgress(Math.round(currentProgress));
        if (currentProgress < targetProgress) {
          t4 = setTimeout(tick, 30);
        } else {
          currentStep++;
          t4 = setTimeout(runStep, 80);
        }
      };
      tick();
    };

    const t5 = setTimeout(runStep, 1400);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(t4); clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <>
      {/* Google Font — Noto Nastaliq Urdu (premium Nastaliq calligraphic) */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Keyframe definitions */}
      <style>{`
        @keyframes sp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sp-spin-rev {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes sp-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.18); }
        }
        @keyframes sp-scan {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes sp-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
        @keyframes sp-bar-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.5); }
          50%       { box-shadow: 0 0 22px rgba(16,185,129,0.9), 0 0 44px rgba(245,158,11,0.3); }
        }
        @keyframes sp-orb-drift {
          0%   { transform: translateY(0) scale(1); }
          100% { transform: translateY(-50px) scale(1.05); }
        }
        @keyframes sp-badge-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes sp-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes sp-corner-in {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        .sp-urdu {
          font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif;
          direction: rtl;
          unicode-bidi: embed;
        }
      `}</style>

      {/* Root overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 65% at 50% 38%, #051a12 0%, #020f09 55%, #000000 100%)',
          opacity: fadingOut ? 0 : 1,
          transform: fadingOut ? 'scale(1.04)' : 'scale(1)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          pointerEvents: fadingOut ? 'none' : 'all',
        }}
      >
        {/* Particle grid */}
        <ParticleCanvas />

        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Top-left emerald orb */}
          <div style={{
            position: 'absolute', top: '8%', left: '10%',
            width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
            filter: 'blur(48px)',
            animation: 'sp-orb-drift 20s ease-in-out infinite alternate',
          }} />
          {/* Bottom-right gold orb */}
          <div style={{
            position: 'absolute', bottom: '8%', right: '10%',
            width: 440, height: 440, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)',
            filter: 'blur(55px)',
            animation: 'sp-orb-drift 25s ease-in-out infinite alternate-reverse',
          }} />
          {/* Centre subtle teal */}
          <div style={{
            position: 'absolute', top: '35%', right: '22%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }} />
        </div>

        {/* Scanning line */}
        <ScanLine />

        {/* ── Content card ── */}
        <div
          className="relative z-10 flex flex-col items-center px-6 sm:px-0"
          style={{ width: '100%', maxWidth: 440 }}
        >
          {/* Status badge */}
          <div
            style={{
              marginBottom: 34,
              opacity: titleVisible ? 1 : 0,
              transition: 'opacity 0.7s ease 0.3s',
              animation: 'sp-badge-float 3.5s ease-in-out infinite',
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 16px',
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#6ee7b7',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.22)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#34d399',
                animation: 'sp-blink 1.3s ease-in-out infinite',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(52,211,153,0.8)',
              }} />
              Enterprise Accounting Suite · v2.0
            </span>
          </div>

          {/* Logo */}
          <LogoRing visible={logoVisible} />

          {/* Brand text */}
          <div style={{ marginTop: 34, textAlign: 'center', width: '100%' }}>
            {/* English title */}
            <h1
              style={{
                fontSize: 'clamp(26px, 7.5vw, 36px)',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 40%, #6ee7b7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: titleVisible ? 1 : 0,
                transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s',
              }}
            >
              KMLWJ
            </h1>

            {/* Decorative golden line */}
            <div style={{
              margin: '10px auto',
              width: titleVisible ? 120 : 0,
              height: 2,
              borderRadius: 9999,
              background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.8), transparent)',
              transition: 'width 1s cubic-bezier(0.16,1,0.3,1) 0.5s',
            }} />

            {/* Urdu name — Noto Nastaliq Urdu */}
            <div
              className="sp-urdu"
              style={{
                marginTop: 8,
                fontSize: 'clamp(22px, 6vw, 30px)',
                fontWeight: 700,
                lineHeight: 1.7,
                background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #fbbf24 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: titleVisible ? 1 : 0,
                transform: titleVisible ? 'translateY(0)' : 'translateY(14px)',
                transition:
                  'opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.4s',
              }}
            >
              کچھی مسلم لوہار واڈہ ویلفیئر جماعت
            </div>

            {/* English subtitle */}
            <p
              style={{
                marginTop: 14,
                fontSize: 12,
                color: 'rgba(167,232,186,0.6)',
                letterSpacing: '0.08em',
                fontWeight: 500,
                textTransform: 'uppercase',
                opacity: titleVisible ? 1 : 0,
                transition: 'opacity 0.8s ease 0.6s',
              }}
            >
              Chart of Accounts · General Ledger · Journal Engine
            </p>
          </div>

          {/* Divider */}
          <div style={{
            width: '100%',
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(16,185,129,0.35), rgba(245,158,11,0.35), transparent)',
            marginTop: 38,
            marginBottom: 28,
            opacity: barVisible ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }} />

          {/* Progress section */}
          <div
            style={{
              width: '100%',
              opacity: barVisible ? 1 : 0,
              transform: barVisible ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
            }}
          >
            {/* Step label row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{
                fontSize: 11,
                color: 'rgba(167,232,186,0.7)',
                fontWeight: 500,
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 7, height: 7, borderRadius: '50%',
                  background: progress < 100 ? '#10b981' : '#34d399',
                  animation: progress < 100 ? 'sp-blink 0.9s ease-in-out infinite' : 'none',
                  boxShadow: '0 0 8px rgba(16,185,129,0.8)',
                }} />
                {stepLabel}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: progress < 100 ? '#6ee7b7' : '#fbbf24',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                transition: 'color 0.4s ease',
              }}>
                {progress}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 5,
              borderRadius: 9999,
              background: 'rgba(5,46,22,0.9)',
              border: '1px solid rgba(16,185,129,0.12)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 9999,
                background:
                  progress < 100
                    ? 'linear-gradient(90deg, #065f46, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #92400e, #f59e0b, #fbbf24)',
                transition: 'width 0.25s ease, background 0.5s ease',
                animation: 'sp-bar-glow 2s ease-in-out infinite',
                position: 'relative',
              }}>
                {/* Shimmer */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'sp-shimmer 1.8s linear infinite',
                }} />
              </div>
            </div>

            {/* Step dots */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingLeft: 2,
              paddingRight: 2,
            }}>
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  title={s.label}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    transition: 'background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease',
                    background:
                      i < stepIndex
                        ? '#065f46'
                        : i === stepIndex
                        ? '#10b981'
                        : 'rgba(30,60,40,0.5)',
                    transform: i === stepIndex ? 'scale(1.6)' : 'scale(1)',
                    boxShadow: i === stepIndex ? '0 0 10px rgba(16,185,129,0.9)' : 'none',
                    border:
                      i <= stepIndex
                        ? '1px solid rgba(16,185,129,0.4)'
                        : '1px solid rgba(30,60,40,0.3)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer disclaimer */}
          <p
            style={{
              marginTop: 38,
              fontSize: 10,
              color: 'rgba(52,211,153,0.35)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              fontWeight: 500,
              opacity: barVisible ? 1 : 0,
              transition: 'opacity 0.6s ease 0.4s',
            }}
          >
            GAAP Compliant · Double-Entry Validated · Secure
          </p>
        </div>

        {/* Corner decorators */}
        {[
          { top: 20, left: 20 },
          { top: 20, right: 20 },
          { bottom: 20, left: 20 },
          { bottom: 20, right: 20 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...pos,
              width: 22,
              height: 22,
              borderColor: i % 2 === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.25)',
              borderStyle: 'solid',
              borderWidth: 0,
              ...(pos.top !== undefined && pos.left !== undefined
                ? { borderTopWidth: 1.5, borderLeftWidth: 1.5 }
                : pos.top !== undefined && pos.right !== undefined
                ? { borderTopWidth: 1.5, borderRightWidth: 1.5 }
                : pos.bottom !== undefined && pos.left !== undefined
                ? { borderBottomWidth: 1.5, borderLeftWidth: 1.5 }
                : { borderBottomWidth: 1.5, borderRightWidth: 1.5 }),
              opacity: barVisible ? 1 : 0,
              transition: `opacity 0.8s ease ${0.5 + i * 0.08}s`,
              animation: barVisible ? 'sp-corner-in 0.5s ease forwards' : 'none',
            }}
          />
        ))}
      </div>
    </>
  );
}
