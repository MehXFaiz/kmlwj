import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { Menu, User, Settings, LogOut, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Topbar = ({ onMobileMenuToggle }) => {
  const { user, loading, logout } = useAuthStore();
  const { 
    selectedSubsidiary, 
    setSelectedSubsidiary, 
    fiscalYear, 
    setFiscalYear 
  } = useCoaStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);
  const { i18n } = useTranslation();
  const language = i18n.language || 'en';

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
    <header className="print-hidden bg-slate-900 border-b border-slate-800/80 z-20 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-6 md:py-0 md:h-16">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Welfare Jamaat Urdu Branding */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2 sm:px-4">
          <span
            dir="rtl"
            className="font-bold text-indigo-200 whitespace-nowrap select-none text-[15px] sm:text-xl text-center w-full pb-2 pt-1"
            style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
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
              className="flex items-center gap-1.5 hover:bg-slate-800/50 p-2 rounded-lg transition-colors cursor-pointer text-slate-300 hover:text-slate-100"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-semibold">{language === 'en' ? 'EN' : 'UR'}</span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>

            {languageMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-800 rounded-md shadow-lg z-50 py-1">
                <button
                  onClick={() => { i18n.changeLanguage('en'); setLanguageMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${language === 'en' ? 'bg-slate-800 text-indigo-400 font-bold' : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'}`}
                >
                  English
                </button>
                <button
                  onClick={() => { i18n.changeLanguage('ur'); setLanguageMenuOpen(false); }}
                  className={`w-full text-right px-4 py-2 text-sm transition-colors ${language === 'ur' ? 'bg-slate-800 text-indigo-400 font-bold' : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'}`}
                  style={{ fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                  dir="rtl"
                >
                  اردو
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:bg-slate-800/50 p-1 pr-2 rounded-lg transition-colors cursor-pointer text-left"
            >
              {loading ? (
                <>
                  <div className="h-8 w-8 rounded-full bg-slate-800 animate-pulse"></div>
                  <div className="hidden xl:flex flex-col gap-1">
                    <div className="h-3 w-20 bg-slate-800 animate-pulse rounded"></div>
                    <div className="h-2 w-12 bg-slate-800 animate-pulse rounded"></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs select-none">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="hidden xl:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-200 leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{user?.role || 'User'}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-400 ml-1 hidden xl:block" />
                </>
              )}
            </button>

            {userMenuOpen && !loading && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-md shadow-lg z-50">
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm select-none shrink-0">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-xs text-slate-400 truncate">{user?.email || 'operator@example.com'}</span>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link to="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <User className="h-4 w-4" /> My Account
                  </Link>
                  <Link to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </div>
                <div className="p-1.5 border-t border-slate-800">
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2 px-2.5 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-sm transition-colors w-full text-left"
                  >
                    <LogOut className="h-4 w-4" /> Logout
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
