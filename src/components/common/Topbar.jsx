import { useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { Globe, Calendar, Bell, ShieldCheck, Sun, Moon, Menu } from 'lucide-react';

export const Topbar = ({ onMobileMenuToggle }) => {
  const { user } = useAuthStore();
  const { 
    selectedSubsidiary, 
    setSelectedSubsidiary, 
    fiscalYear, 
    setFiscalYear 
  } = useCoaStore();

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
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-800/40 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">GL Live</span>
          </div>

          <button className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-slate-900"></span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs cursor-help" title="Fully GAAP / IFRS compliant mock sandbox">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">SOX Audit Enabled</span>
          </div>

          <button onClick={() => {
              const dark = document.documentElement.classList.toggle('dark');
              try{ localStorage.setItem('theme', dark ? 'dark' : 'light'); }catch(e){}
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            {document.documentElement.classList.contains('dark') ? <Sun className="h-4.5 w-4.5"/> : <Moon className="h-4.5 w-4.5"/>}
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 font-bold text-xs select-none">
              {getInitials(user?.fullName)}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-none">{user?.fullName || 'Operator'}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{user?.role || 'User'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
