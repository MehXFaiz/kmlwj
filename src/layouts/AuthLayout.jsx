import React from 'react';
import { ShieldCheck, BarChart3, BookOpen, Zap } from 'lucide-react';
import logoImg from '../assets/logo.png';

const features = [
  { icon: ShieldCheck, label: 'Bank-Grade Security', desc: 'End-to-end encrypted sessions' },
  { icon: BarChart3,  label: 'Real-Time Ledger',    desc: 'Instant financial insights'    },
  { icon: BookOpen,  label: 'Double-Entry System',  desc: 'GAAP compliant bookkeeping'    },
  { icon: Zap,       label: 'Blazing Fast',          desc: 'Sub-second report generation'  },
];

export const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-slate-950 overflow-x-hidden">
      {/* ─── LEFT BRANDING PANEL ─── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col justify-between p-10 xl:p-14 shrink-0">
        {/* Background gradient — deep blue tones */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-amber-950/60 to-slate-900" />

        {/* Ambient glow orbs */}
        <div className="absolute top-[15%] left-[10%] w-72 h-72 bg-amber-500/10 rounded-full blur-[100px] animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-blue-600/15 rounded-full blur-[100px] animate-[float_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[55%] left-[40%] w-48 h-48 bg-amber-600/8 rounded-full blur-[80px] animate-[float_7s_ease-in-out_infinite_1s]" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Logo + Urdu brand header */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <img
              src={logoImg}
              alt="KMLWJ Logo"
              className="w-14 h-14 object-contain filter drop-shadow(0 0 12px rgba(99,102,241,0.4))"
            />
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/90 to-slate-900/80 border border-amber-800/50 shadow-lg shadow-amber-900/20">
              <span className="text-lg font-black tracking-[0.18em] bg-gradient-to-r from-amber-300 via-blue-300 to-amber-400 bg-clip-text text-transparent">KMLWJ</span>
            </div>
          </div>
          <div
            className="font-bold text-amber-200/90 mt-2"
            style={{
              fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              fontSize: '1.25rem',
              lineHeight: 2,
            }}
          >
            کچھی مسلم لوہار واڈہ ویلفیئر جماعت
          </div>
          <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs">
            Enterprise Resource Planning for modern finance teams
          </p>
        </div>

        {/* Hero headline */}
        <div className="relative z-10 -mt-8">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.15] tracking-tight">
            <span className="text-white">Financial </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-blue-400 to-amber-300">
              clarity
            </span>
            <br />
            <span className="text-white">starts here.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mt-5 max-w-sm">
            Manage your chart of accounts, journal entries, and financial reports
            with confidence and precision.
          </p>
        </div>

        {/* Feature cards — blue-tinted glass */}
        <div className="relative z-10 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-amber-800/20 backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-blue-700/30 border border-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── FORM PANEL ─── */}
      <div className="flex-1 w-full min-w-0 min-h-[100dvh] lg:min-h-screen overflow-y-auto overflow-x-hidden relative">
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(500px,100vw)] h-[min(500px,100vh)] bg-amber-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[420px] mx-auto px-4 sm:px-6 py-5 sm:py-8 lg:py-12 relative z-10 min-h-[100dvh] lg:min-h-0 flex flex-col justify-start sm:justify-center box-border">
          {/* Mobile-only logo header */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-4 sm:mb-6 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <img
                src={logoImg}
                alt="KMLWJ Logo"
                className="w-10 h-10 object-contain filter drop-shadow(0 0 8px rgba(99,102,241,0.4))"
              />
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/90 to-slate-900/80 border border-amber-800/50 shadow-lg shadow-amber-900/20">
                <span className="text-base sm:text-lg font-black tracking-[0.18em] bg-gradient-to-r from-amber-300 via-blue-300 to-amber-400 bg-clip-text text-transparent">KMLWJ</span>
              </div>
            </div>
            <div
              className="font-bold text-amber-200/90 text-center"
              style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                fontSize: '1rem',
                lineHeight: 2,
              }}
            >
              کچھی مسلم لوہار واڈہ ویلفیئر جماعت
            </div>
          </div>

          <div className="w-full min-w-0 pb-6 sm:pb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
