import React from 'react';
import { ShieldCheck, BarChart3, BookOpen, Zap } from 'lucide-react';

const features = [
  { icon: ShieldCheck, label: 'Bank-Grade Security', desc: 'End-to-end encrypted sessions' },
  { icon: BarChart3, label: 'Real-Time Ledger', desc: 'Instant financial insights' },
  { icon: BookOpen, label: 'Double-Entry System', desc: 'GAAP compliant bookkeeping' },
  { icon: Zap, label: 'Blazing Fast', desc: 'Sub-second report generation' },
];

export const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* ─── LEFT BRANDING PANEL ─── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col justify-between p-10 xl:p-14">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900" />

        {/* Floating orbs */}
        <div className="absolute top-[15%] left-[10%] w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] animate-[float_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[55%] left-[40%] w-48 h-48 bg-blue-500/8 rounded-full blur-[80px] animate-[float_7s_ease-in-out_infinite_1s]" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top — Logo & Tagline */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-900/80 to-slate-900/80 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
              <span className="text-lg font-black tracking-[0.18em] bg-gradient-to-r from-indigo-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">KMLWJ</span>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
            Enterprise Resource Planning for modern finance teams
          </p>
        </div>

        {/* Center — Hero Heading */}
        <div className="relative z-10 -mt-8">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.15] tracking-tight">
            <span className="text-white">Financial </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400">
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

        {/* Bottom — Feature Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">{label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT FORM PANEL ─── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative min-h-0 overflow-y-auto">
        {/* Subtle radial glow behind form */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile-only logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-900/80 to-slate-900/80 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
              <span className="text-lg font-black tracking-[0.18em] bg-gradient-to-r from-indigo-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">KMLWJ</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};
