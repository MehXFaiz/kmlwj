import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Menu, User, Settings, LogOut, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColorPalettePicker } from './ColorPalettePicker';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useShallow } from 'zustand/react/shallow';
import logoImg from '../../assets/logo.png';

export const Topbar = ({ onMobileMenuToggle }) => {
  const { user, loading, logout } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      logout: state.logout,
    }))
  );
  const initPalette = useThemeStore((state) => state.initPalette);
  const { 
    selectedSubsidiary, 
    setSelectedSubsidiary, 
    fiscalYear, 
    setFiscalYear 
  } = useCoaStore(
    useShallow((state) => ({
      selectedSubsidiary: state.selectedSubsidiary,
      setSelectedSubsidiary: state.setSelectedSubsidiary,
      fiscalYear: state.fiscalYear,
      setFiscalYear: state.setFiscalYear,
    }))
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);
  const { i18n } = useTranslation();
  const language = i18n.language || 'en';

  useEffect(() => {
    initPalette();
  }, []);

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

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const subsidiaries = ['Global', 'Acme US', 'Acme Europe', 'Acme APAC'];
  const fiscalYears = ['2025', '2026', '2027'];

  return (
    <header className="print-hidden bg-slate-900 z-20 shrink-0 relative" style={{ boxShadow: '0 1px 0 0 rgba(255,255,255,0.04), 0 2px 12px 0 rgba(0,0,0,0.35)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-6 md:py-0 md:h-14">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Welfare Jamaat Urdu Branding with Logo */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2 sm:px-4 gap-3">
          <img
            src={logoImg}
            alt="KMLWJ Logo"
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain filter drop-shadow(0 0 8px rgba(200,122,71,0.4)) shrink-0"
          />
          <span
            dir="rtl"
            className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-200 to-brand-400 truncate select-none text-[17px] sm:text-[22px] text-center leading-relaxed"
            style={{
              fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              lineHeight: 2,
              letterSpacing: '0.01em',
            }}
          >
            کچھی مسلم لوہار واڈہ ویلفیئر جماعت
          </span>
        </div>

        {/* Right side - Actions & User Menu */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">

          {/* Language Menu */}
          <div className="relative" ref={languageMenuRef}>
            <button 
              onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer text-slate-400 hover:text-slate-100"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">{language === 'en' ? 'EN' : 'UR'}</span>
              <ChevronDown className="h-3 w-3 text-slate-600" />
            </button>

            {languageMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-slate-900 border border-slate-800/80 rounded-xl shadow-2xl shadow-black/50 z-50 p-1 overflow-hidden">
                <button
                  onClick={() => { i18n.changeLanguage('en'); setLanguageMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-all ${language === 'en' ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
                >
                  🇺🇸 &nbsp;English
                </button>
                <button
                  onClick={() => { i18n.changeLanguage('ur'); setLanguageMenuOpen(false); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold rounded-lg transition-all ${language === 'ur' ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                  dir="rtl"
                >
                  اردو 🇵🇰
                </button>
              </div>
            )}
          </div>

          {/* Theme switcher */}
          <ThemeToggle />

          {/* Color Palette Picker */}
          <ColorPalettePicker />

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-1.5 py-1 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer text-left"
            >
              {loading ? (
                <>
                  <div className="h-7 w-7 rounded-full bg-slate-800 animate-pulse"></div>
                  <div className="hidden xl:flex flex-col gap-1">
                    <div className="h-3 w-20 bg-slate-800 animate-pulse rounded"></div>
                    <div className="h-2 w-12 bg-slate-800 animate-pulse rounded"></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-7 w-7 rounded-full bg-brand-500/25 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-[11px] select-none">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="hidden xl:flex flex-col text-left pr-1">
                    <span className="text-xs font-bold text-slate-100 leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{user?.role || 'User'}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-500 hidden xl:block" />
                </>
              )}
            </button>

            {userMenuOpen && !loading && (
              <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-sm select-none shrink-0">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-100 truncate leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email || 'operator@example.com'}</span>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <User className="h-3.5 w-3.5" /> Profile
                  </Link>
                  <Link to="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <User className="h-3.5 w-3.5" /> My Account
                  </Link>
                  <Link to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </div>
                <div className="p-1.5 border-t border-slate-800/80">
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all w-full text-left"
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
