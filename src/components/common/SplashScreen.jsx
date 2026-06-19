import { useEffect, useState, useRef } from 'react';

/* ─────────────────────────────────────────────
   Animated SVG Logo Mark
───────────────────────────────────────────── */
function LogoMark({ visible }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(30px)',
        transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Outer rotating ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          background: 'conic-gradient(from 0deg, transparent 60%, rgba(99,102,241,0.8) 100%)',
          animation: 'splash-spin 2.5s linear infinite',
        }}
      />
      {/* Inner ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 116,
          height: 116,
          background: 'conic-gradient(from 180deg, transparent 60%, rgba(59,130,246,0.6) 100%)',
          animation: 'splash-spin-reverse 3.5s linear infinite',
        }}
      />
      {/* Glow backdrop */}
      <div
        className="absolute rounded-full"
        style={{
          width: 100,
          height: 100,
          background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
          filter: 'blur(8px)',
          animation: 'splash-pulse 2s ease-in-out infinite',
        }}
      />
      {/* KMLWJ Text Logo */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: 110,
          height: 88,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(30,27,75,0.9) 0%, rgba(15,23,42,0.95) 100%)',
          border: '1.5px solid rgba(129,140,248,0.35)',
          boxShadow: '0 0 40px rgba(99,102,241,0.45)',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: '0.22em',
            background: 'linear-gradient(135deg, #a5b4fc 0%, #60a5fa 50%, #34d399 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
          }}
        >
          KMLWJ
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Particle / Grid Background
───────────────────────────────────────────── */
function ParticleGrid() {
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

    // Generate dots
    const COLS = 28;
    const ROWS = 18;
    const dots = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        dots.push({
          bx: (c / (COLS - 1)) * window.innerWidth,
          by: (r / (ROWS - 1)) * window.innerHeight,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.6,
          amp: 2 + Math.random() * 4,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;

      dots.forEach((d) => {
        const x = d.bx + Math.sin(t * d.speed + d.phase) * d.amp;
        const y = d.by + Math.cos(t * d.speed + d.phase + 1.2) * d.amp;

        // Distance from center for opacity pulse
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const maxDist = Math.hypot(cx, cy);
        const proximity = 1 - dist / maxDist;
        const alpha = 0.04 + proximity * 0.12 + Math.sin(t * 1.5 + d.phase) * 0.04;

        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${Math.max(0, alpha)})`;
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
   Scanning Line Animation
───────────────────────────────────────────── */
function ScanLine() {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none overflow-hidden"
      style={{ top: 0, height: '100%' }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 40%, rgba(59,130,246,0.8) 50%, rgba(99,102,241,0.6) 60%, transparent 100%)',
          animation: 'splash-scan 3s ease-in-out infinite',
          boxShadow: '0 0 12px rgba(99,102,241,0.5)',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Module Loading Steps
───────────────────────────────────────────── */
const STEPS = [
  { label: 'Initializing Core Engine',          duration: 480 },
  { label: 'Loading Chart of Accounts',         duration: 520 },
  { label: 'Hydrating General Ledger',          duration: 440 },
  { label: 'Syncing Journal Entries',           duration: 380 },
  { label: 'Verifying Audit Trail',             duration: 350 },
  { label: 'Applying GAAP Compliance Rules',   duration: 420 },
  { label: 'Establishing Secure Session',       duration: 310 },
  { label: 'System Ready',                      duration: 250 },
];

/* ─────────────────────────────────────────────
   Main Splash Screen
───────────────────────────────────────────── */
export function SplashScreen({ onComplete }) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepLabel, setStepLabel] = useState(STEPS[0].label);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Staggered entrance
    const t1 = setTimeout(() => setLogoVisible(true), 200);
    const t2 = setTimeout(() => setTitleVisible(true), 700);
    const t3 = setTimeout(() => setBarVisible(true), 1100);

    // Progress simulation
    let currentStep = 0;
    let currentProgress = 0;
    let t4;

    const runStep = () => {
      if (currentStep >= STEPS.length) {
        setTimeout(() => {
          setFadingOut(true);
          setTimeout(() => onComplete?.(), 700);
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

    const t5 = setTimeout(runStep, 1300);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(t4); clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes splash-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes splash-spin-reverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes splash-scan {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes splash-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes splash-bar-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.6); }
          50%       { box-shadow: 0 0 20px rgba(99,102,241,0.9), 0 0 40px rgba(59,130,246,0.4); }
        }
        @keyframes splash-grid-drift {
          0%   { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-60px) rotate(2deg); }
        }
        @keyframes splash-float-badge {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes splash-char-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Root overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0f0c2e 0%, #020617 60%, #000000 100%)',
          opacity: fadingOut ? 0 : 1,
          transform: fadingOut ? 'scale(1.03)' : 'scale(1)',
          transition: 'opacity 0.65s ease, transform 0.65s ease',
          pointerEvents: fadingOut ? 'none' : 'all',
        }}
      >
        {/* Animated grid dots */}
        <ParticleGrid />

        {/* Large blurred orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: 'absolute', top: '10%', left: '15%',
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'splash-grid-drift 18s ease-in-out infinite alternate',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '12%',
            width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'splash-grid-drift 22s ease-in-out infinite alternate-reverse',
          }} />
          <div style={{
            position: 'absolute', top: '40%', right: '20%',
            width: 280, height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
            filter: 'blur(35px)',
          }} />
        </div>

        {/* Scanning line */}
        <ScanLine />

        {/* ── Content Card ── */}
        <div className="relative z-10 flex flex-col items-center gap-0 select-none px-6 sm:px-0" style={{ width: '100%', maxWidth: 420 }}>

          {/* Floating badge */}
          <div
            style={{
              marginBottom: 32,
              opacity: titleVisible ? 1 : 0,
              transition: 'opacity 0.6s ease 0.4s',
              animation: 'splash-float-badge 3s ease-in-out infinite',
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#a5b4fc',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#34d399',
                animation: 'splash-blink 1.2s ease-in-out infinite',
                display: 'inline-block',
              }} />
              Enterprise Financial Suite v2.0
            </span>
          </div>

          {/* Logo mark */}
          <LogoMark visible={logoVisible} />

          {/* Brand name */}
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 'clamp(28px, 8vw, 38px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: titleVisible ? 1 : 0,
                transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s',
              }}
            >
              KMLWJ
            </h1>
            <div
              style={{
                marginTop: 12,
                fontSize: 'clamp(18px, 5vw, 22px)',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: titleVisible ? 1 : 0,
                transform: titleVisible ? 'translateY(0)' : 'translateY(15px)',
                transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s',
                fontFamily: "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              }}
            >
              کچھی مسلم لوہار واڈہ ویلفیئر جماعت
            </div>
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: 'rgba(148,163,184,0.8)',
                letterSpacing: '0.04em',
                fontWeight: 400,
                opacity: titleVisible ? 1 : 0,
                transition: 'opacity 0.8s ease 0.5s',
              }}
            >
              Chart of Accounts · General Ledger · Journal Engine
            </p>
          </div>

          {/* Divider */}
          <div style={{
            width: '100%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(59,130,246,0.4), transparent)',
            marginTop: 36,
            marginBottom: 28,
            opacity: barVisible ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }} />

          {/* Progress section */}
          <div
            style={{
              width: '100%',
              opacity: barVisible ? 1 : 0,
              transform: barVisible ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
            }}
          >
            {/* Step label */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{
                fontSize: 11,
                color: 'rgba(148,163,184,0.75)',
                fontWeight: 500,
                letterSpacing: '0.03em',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: progress < 100 ? '#6366f1' : '#34d399',
                  animation: progress < 100 ? 'splash-blink 0.8s ease-in-out infinite' : 'none',
                  boxShadow: '0 0 8px rgba(99,102,241,0.8)',
                }} />
                {stepLabel}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: progress < 100 ? '#818cf8' : '#34d399',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                transition: 'color 0.4s ease',
              }}>
                {progress}%
              </span>
            </div>

            {/* Progress bar track */}
            <div style={{
              width: '100%',
              height: 5,
              borderRadius: 9999,
              background: 'rgba(30,27,75,0.8)',
              border: '1px solid rgba(99,102,241,0.15)',
              overflow: 'hidden',
            }}>
              {/* Fill */}
              <div style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 9999,
                background: progress < 100
                  ? 'linear-gradient(90deg, #4f46e5, #6366f1, #60a5fa)'
                  : 'linear-gradient(90deg, #059669, #34d399, #6ee7b7)',
                transition: 'width 0.25s ease, background 0.5s ease',
                animation: 'splash-bar-glow 2s ease-in-out infinite',
                position: 'relative',
              }}>
                {/* Shimmer streak */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'splash-scan 1.6s linear infinite',
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
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    transition: 'background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease',
                    background: i <= stepIndex
                      ? (i === stepIndex ? '#6366f1' : '#1e1b4b')
                      : 'rgba(51,65,85,0.5)',
                    transform: i === stepIndex ? 'scale(1.5)' : 'scale(1)',
                    boxShadow: i === stepIndex ? '0 0 10px rgba(99,102,241,0.9)' : 'none',
                    border: i <= stepIndex ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(51,65,85,0.3)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bottom disclaimer */}
          <p
            style={{
              marginTop: 40,
              fontSize: 10,
              color: 'rgba(100,116,139,0.6)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 500,
              opacity: barVisible ? 1 : 0,
              transition: 'opacity 0.6s ease 0.3s',
            }}
          >
            GAAP Compliant · SOX Ready · Double-Entry Validated
          </p>
        </div>

        {/* Corner decorators */}
        {[
          { top: 24, left: 24 },
          { top: 24, right: 24 },
          { bottom: 24, left: 24 },
          { bottom: 24, right: 24 },
        ].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute',
            ...pos,
            width: 20,
            height: 20,
            borderColor: 'rgba(99,102,241,0.25)',
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
            transition: 'opacity 0.8s ease 0.6s',
          }} />
        ))}
      </div>
    </>
  );
}
