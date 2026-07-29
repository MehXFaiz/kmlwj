import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { ShieldCheck, BarChart3, BookOpen, Zap } from 'lucide-react';
import logoImg from '../assets/logo.png';

// Copy lives in the translation catalogue; only the icon and key are static here.
const features = [
  { icon: ShieldCheck, key: 'security' },
  { icon: BarChart3,   key: 'ledger'   },
  { icon: BookOpen,    key: 'doubleEntry' },
  { icon: Zap,         key: 'fast'     },
];

export const AuthLayout = ({ children }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-slate-950 overflow-x-hidden">

      {/* ─── LEFT BRANDING PANEL (≈42%) ─── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[44%] relative overflow-hidden flex-col justify-between p-12 xl:p-16 shrink-0">
        {/* Deep background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-brand-950/30 to-slate-950" />

        {/* Radial mocha glow — centered hero orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(150,114,89,0.12) 0%, rgba(150,114,89,0.04) 40%, transparent 70%)' }}
        />

        {/* Floating ambient orbs */}
        <div className="absolute top-[12%] left-[8%] w-64 h-64 bg-brand-500/8 rounded-full blur-[100px] animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[15%] right-[10%] w-72 h-72 bg-brand-600/10 rounded-full blur-[100px] animate-[float_10s_ease-in-out_infinite_2s]" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* ── Top: Logo + Urdu brand ── */}
        <div className="relative z-10 animate-[fadeSlideDown_0.8s_ease-out_both]">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-brand-500/15 rounded-2xl blur-xl" />
              <img
                src={logoImg}
                alt={t('auth.logoAlt')}
                className="relative w-14 h-14 object-contain"
              />
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-brand-950/80 border border-brand-800/30 backdrop-blur-sm">
              <span className="text-lg font-black tracking-[0.2em] bg-gradient-to-r from-brand-300 via-brand-200 to-brand-400 bg-clip-text text-transparent">
                KMLWJ
              </span>
            </div>
          </div>
          <div
            className="font-bold text-brand-300/90 mt-1"
            style={{
              fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              fontSize: '1.25rem',
              lineHeight: 2,
            }}
          >
            {t('auth.orgName')}
          </div>
        </div>

        {/* ── Middle: Hero headline ── */}
        <div className="relative z-10 animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.12] tracking-tight text-slate-100">
            <Trans
              i18nKey="auth.heroHeadline"
              components={{
                hl: <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500" />,
                br: <br />,
              }}
            />
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mt-5 max-w-sm">
            {t('auth.heroSubtitle')}
          </p>
        </div>

        {/* ── Bottom: Feature cards ── */}
        <div className="relative z-10 grid grid-cols-2 gap-3 animate-[fadeSlideUp_0.8s_ease-out_0.4s_both]">
          {features.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="group/card flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-brand-800/15
                         backdrop-blur-sm hover:bg-white/[0.06] hover:border-brand-700/25
                         transition-all duration-300 cursor-default"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/30 border border-brand-500/15
                              flex items-center justify-center shrink-0 mt-0.5
                              group-hover/card:scale-110 group-hover/card:from-brand-500/30 transition-all duration-300">
                <Icon className="w-4 h-4 text-brand-400 group-hover/card:text-brand-300 transition-colors duration-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">{t(`auth.features.${key}.label`)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t(`auth.features.${key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT: FORM PANEL (≈58%) ─── */}
      <div className="flex-1 w-full min-w-0 min-h-[100dvh] lg:min-h-screen overflow-y-auto overflow-x-hidden relative flex items-center justify-center">
        {/* Subtle ambient glow behind card */}
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(150,114,89,0.06) 0%, transparent 70%)' }}
        />

        {/* Vertical separator line on desktop */}
        <div className="hidden lg:block absolute top-[10%] bottom-[10%] left-0 w-px bg-gradient-to-b from-transparent via-brand-800/20 to-transparent" />

        <div className="w-full max-w-[440px] mx-auto px-5 sm:px-8 py-6 sm:py-10 lg:py-12 relative z-10 box-border">
          {/* Mobile-only logo header */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-6 sm:mb-8 shrink-0 gap-3 animate-[fadeSlideDown_0.6s_ease-out_both]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-2 bg-brand-500/15 rounded-2xl blur-xl" />
                <img
                  src={logoImg}
                  alt={t('auth.logoAlt')}
                  className="relative w-10 h-10 object-contain"
                />
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-brand-950/80 border border-brand-800/30 backdrop-blur-sm">
                <span className="text-base sm:text-lg font-black tracking-[0.18em] bg-gradient-to-r from-brand-300 via-brand-200 to-brand-400 bg-clip-text text-transparent">
                  KMLWJ
                </span>
              </div>
            </div>
            <div
              className="font-bold text-brand-300/90 text-center"
              style={{
                fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                fontSize: '1rem',
                lineHeight: 2,
              }}
            >
              {t('auth.orgName')}
            </div>
          </div>

          <div className="w-full min-w-0 animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
