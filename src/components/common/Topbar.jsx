import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentFiscalYear, useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { Menu, User, Settings, LogOut, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import logoImg from '../../assets/logo.png';

const ORG_NAME_URDU = 'کچھی مسلم لوہارواڈھا ویلفیئر جماعت';

/**
 * Nastaliq needs far more vertical room than its own metrics declare — the Kaaf
 * dandi inks roughly 0.85em ABOVE the ascent the face reports, so a normal line
 * box crops the stroke and the letter reads as "broken". line-height clears the
 * descender and the top padding absorbs the overshoot, which extra line-height
 * cannot do on its own because half-leading is split evenly across both edges.
 *
 * letterSpacing MUST stay at 0: Nastaliq is a cursive, contextually-joined
 * script, and any positive tracking pulls the glyphs apart and breaks the
 * ligature joins.
 */
const urduTitleStyle = {
  fontFamily:
    "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Alvi Nastaleeq', serif",
  fontWeight: '500',
  lineHeight: 2.1,
  paddingTop: '0.35em',
  letterSpacing: '0px',
  wordSpacing: '0.15em',
  fontVariantLigatures: 'common-ligatures contextual',
  textRendering: 'optimizeLegibility',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  direction: 'rtl',
  unicodeBidi: 'isolate',
  whiteSpace: 'nowrap',
};

/** Every right-hand control shares this height/radius so the row reads as one unit. */
const controlBase =
  'h-9 inline-flex items-center gap-1.5 rounded-lg border border-brand-800/40 bg-brand-950/30 ' +
  'text-slate-400 transition-colors hover:bg-brand-900/25 hover:border-brand-700/60 hover:text-slate-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-slate-900';

const menuItemClass =
  'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 rounded-lg w-full text-left ' +
  'transition-colors hover:bg-brand-900/30 hover:text-slate-100 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-brand-500';

export const Topbar = ({ onMobileMenuToggle }) => {
  const { user, loading, logout } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      logout: state.logout,
    }))
  );
  const {
    fiscalYear,
    syncFiscalYear,
  } = useCoaStore(
    useShallow((state) => ({
      fiscalYear: state.fiscalYear,
      syncFiscalYear: state.syncFiscalYear,
    }))
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);

  const [currentFiscalYear, setCurrentFiscalYear] = useState(getCurrentFiscalYear);

  const { i18n } = useTranslation();
  const language = i18n.language || 'en';

  useEffect(() => {
    const syncCurrentYear = () => {
      const nextYear = syncFiscalYear();
      setCurrentFiscalYear(nextYear);
    };

    syncCurrentYear();
    const intervalId = window.setInterval(syncCurrentYear, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [syncFiscalYear]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes whichever menu is open and returns focus to the page.
  useEffect(() => {
    if (!userMenuOpen && !languageMenuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setLanguageMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [userMenuOpen, languageMenuOpen]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayedFiscalYear = fiscalYear === currentFiscalYear ? fiscalYear : currentFiscalYear;

  return (
    <header
      className="print-hidden relative z-20 shrink-0 bg-slate-900 border-b border-brand-800/40"
      style={{ boxShadow: '0 1px 0 0 rgba(150,114,89,0.06), 0 4px 20px 0 rgba(0,0,0,0.45)' }}
    >
      <div className="flex items-stretch gap-2 px-3 sm:px-4 md:px-6 min-h-[60px] md:min-h-[76px]">

        {/* ── Left: mobile menu + brand mark ─────────────────────────────── */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            onClick={onMobileMenuToggle}
            className={`${controlBase} w-9 justify-center lg:hidden`}
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/"
            aria-label="KMLWJ home"
            className="flex items-center shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 lg:hidden"
          >
            <span className="flex items-center justify-center h-9 w-9 rounded-xl border border-brand-700/40 bg-brand-950/40 p-1 shadow-inner">
              <img src={logoImg} alt="" className="h-full w-full object-contain" />
            </span>
          </Link>
        </div>

        {/* ── Centre: Urdu wordmark (primary) + English subtitle ──────────── */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 sm:px-6 overflow-hidden">
          <h1
            dir="rtl"
            lang="ur"
            title={ORG_NAME_URDU}
            className="select-none text-center max-w-full text-[#F5E6D3] dark:text-[#F3E5D8]
                       text-[13px] sm:text-[15px] md:text-[17px] font-semibold"
            style={urduTitleStyle}
          >
            {ORG_NAME_URDU}
          </h1>
          <p className="hidden sm:block -mt-1 text-[8.5px] md:text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-400/80 text-center truncate max-w-full">
            Kutchi Muslim Loharwada Welfare Jamaat
          </p>
        </div>

        {/* ── Right: fiscal year · language · profile ─────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Fiscal year */}
          <div className="hidden md:block">
            <label htmlFor="topbar-fiscal-year" className="sr-only">Select fiscal year</label>
            <select
              id="topbar-fiscal-year"
              value={displayedFiscalYear}
              onChange={syncFiscalYear}
              className={`${controlBase} px-3 text-[11px] font-semibold cursor-pointer appearance-none`}
            >
              <option value={displayedFiscalYear}>{`FY ${displayedFiscalYear}`}</option>
            </select>
          </div>

          {/* Language */}
          <div className="relative" ref={languageMenuRef}>
            <button
              onClick={() => { setLanguageMenuOpen(!languageMenuOpen); setUserMenuOpen(false); }}
              className={`${controlBase} px-2.5 cursor-pointer`}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-label={`Change language, current language ${language === 'en' ? 'English' : 'Urdu'}`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">
                {language === 'en' ? 'EN' : 'UR'}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-600 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {languageMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-36 bg-slate-900 border border-brand-800/50 rounded-xl shadow-2xl shadow-black/50 z-50 p-1 overflow-hidden">
                <button
                  role="menuitem"
                  onClick={() => { i18n.changeLanguage('en'); setLanguageMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${language === 'en' ? 'bg-brand-900/40 text-brand-300' : 'text-slate-400 hover:bg-brand-900/30 hover:text-slate-100'}`}
                >
                  🇺🇸 &nbsp;English
                </button>
                <button
                  role="menuitem"
                  onClick={() => { i18n.changeLanguage('ur'); setLanguageMenuOpen(false); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${language === 'ur' ? 'bg-brand-900/40 text-brand-300' : 'text-slate-400 hover:bg-brand-900/30 hover:text-slate-100'}`}
                  style={{ ...urduTitleStyle, lineHeight: 2, paddingTop: '0.55em' }}
                  dir="rtl"
                  lang="ur"
                >
                  اردو 🇵🇰
                </button>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setLanguageMenuOpen(false); }}
              className={`${controlBase} pl-1 pr-2 cursor-pointer text-left`}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Open account menu"
            >
              {loading ? (
                <>
                  <span className="h-7 w-7 rounded-full bg-brand-900/50 animate-pulse" />
                  <span className="hidden xl:flex flex-col gap-1">
                    <span className="h-3 w-20 bg-brand-900/50 animate-pulse rounded" />
                    <span className="h-2 w-12 bg-brand-900/50 animate-pulse rounded" />
                  </span>
                </>
              ) : (
                <>
                  <span className="h-7 w-7 rounded-full bg-brand-500/25 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-[11px] select-none shrink-0">
                    {getInitials(user?.name || user?.fullName)}
                  </span>
                  <span className="hidden xl:flex flex-col text-left leading-none">
                    <span className="text-xs font-bold text-slate-100">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{user?.role || 'User'}</span>
                  </span>
                  <ChevronDown className={`h-3 w-3 text-slate-500 hidden xl:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {userMenuOpen && !loading && (
              <div role="menu" className="absolute right-0 mt-2 w-60 bg-slate-900 border border-brand-800/50 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-brand-800/40 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-sm select-none shrink-0">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-100 truncate leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email || 'operator@example.com'}</span>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link role="menuitem" to="/profile" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                    <User className="h-3.5 w-3.5" /> Profile
                  </Link>
                  <Link role="menuitem" to="/account" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                    <User className="h-3.5 w-3.5" /> My Account
                  </Link>
                  <Link role="menuitem" to="/settings" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </div>
                <div className="p-1.5 border-t border-brand-800/40">
                  <button
                    role="menuitem"
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 rounded-lg w-full text-left transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
