import { useState, useRef, useEffect } from 'react';
import { useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { Globe, Calendar, Bell, ShieldCheck, Menu, User, Settings, LogOut, ChevronDown } from 'lucide-react';

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
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
    <header className="bg-slate-900 border-b border-slate-800/80 z-20 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-6 md:py-0 md:h-16">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Filters */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none">
            <Globe className="h-4 w-4 text-slate-400 shrink-0 hidden xs:block" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline shrink-0">Entity:</span>
            <select
              value={selectedSubsidiary}
              onChange={(e) => setSelectedSubsidiary(e.target.value)}
              className="w-full sm:w-auto min-w-0 max-w-[9rem] sm:max-w-none bg-slate-950/60 border border-slate-800 text-xs font-semibold text-slate-200 py-1.5 px-2 sm:px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer truncate"
            >
              {subsidiaries.map((sub) => (
                <option key={sub} value={sub} className="bg-slate-950 text-slate-200">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0 hidden xs:block" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">FY:</span>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 text-xs font-semibold text-slate-200 py-1.5 px-2 sm:px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer"
            >
              {fiscalYears.map((year) => (
                <option key={year} value={year} className="bg-slate-950 text-slate-200">
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side - User & System Indicators */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
          {/* GL Live badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-800/40 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">GL Live</span>
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-slate-900"></span>
          </button>

          {/* SOX Audit */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs cursor-help" title="Fully GAAP / IFRS compliant mock sandbox">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">SOX Audit Enabled</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

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
                  <button className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <User className="h-4 w-4" /> Profile
                  </button>
                  <button className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <User className="h-4 w-4" /> My Account
                  </button>
                  <button className="flex items-center gap-2 px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-sm transition-colors w-full text-left">
                    <Settings className="h-4 w-4" /> Settings
                  </button>
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
