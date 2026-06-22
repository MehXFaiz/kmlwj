import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo } from 'react';
import logoImg from '../../assets/logo.png';
import { useAuthStore } from '../../store/authStore';
import { searchService } from '../../services/apiServices';
import {
  LayoutDashboard,
  Layers,
  BookOpen,
  FileSpreadsheet,
  History,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Users,
  X,
  Heart,
  FileText,
  Search,
  ArrowRight,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Activity,
  RefreshCw,
  LogOut,
  ChevronDown,
  Wallet,
  UserCircle,
  BadgeCheck,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Section accent colors by section index
───────────────────────────────────────────── */
const SECTION_ACCENTS = [
  { label: 'text-indigo-400',  icon: 'text-indigo-400',  iconBg: 'bg-indigo-500/10 border-indigo-500/20',   active: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',   activeDot: 'bg-indigo-400' },
  { label: 'text-emerald-400', icon: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20', active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', activeDot: 'bg-emerald-400' },
  { label: 'text-violet-400',  icon: 'text-violet-400',  iconBg: 'bg-violet-500/10 border-violet-500/20',   active: 'bg-violet-500/10 text-violet-300 border-violet-500/30',   activeDot: 'bg-violet-400' },
  { label: 'text-rose-400',    icon: 'text-rose-400',    iconBg: 'bg-rose-500/10 border-rose-500/20',       active: 'bg-rose-500/10 text-rose-300 border-rose-500/30',         activeDot: 'bg-rose-400' },
  { label: 'text-amber-400',   icon: 'text-amber-400',   iconBg: 'bg-amber-500/10 border-amber-500/20',     active: 'bg-amber-500/10 text-amber-300 border-amber-500/30',     activeDot: 'bg-amber-400' },
];

export const Sidebar = ({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isPathActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.includes('?')) return (location.pathname + location.search) === path;
    return location.pathname.startsWith(path.split('?')[0]);
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ accounts: [], beneficiaries: [], donations: [], journalEntries: [], customers: [], invoices: [] });

  const inputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  // Ctrl+K key binding
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setResults({ accounts: [], beneficiaries: [], donations: [], journalEntries: [], customers: [], invoices: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  // Debounced API search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ accounts: [], beneficiaries: [], donations: [], journalEntries: [], customers: [], invoices: [] });
      return;
    }
    setLoading(true);
    const delay = setTimeout(async () => {
      try {
        const data = await searchService.search(query);
        setResults(data || { accounts: [], beneficiaries: [], donations: [], journalEntries: [], customers: [], invoices: [] });
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(delay);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setIsSearchOpen(false);
    };
    if (isSearchOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setIsSearchOpen(false); };
    if (isSearchOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isSearchOpen]);

  const hasPerm = (requiredPerms) => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    if (!user.permissions) return false;
    return requiredPerms.some(p => user.permissions.includes(p));
  };

  const sidebarSections = useMemo(() => [
    {
      title: 'Core Accounting',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
        {
          name: 'Chart of Accounts',
          icon: Layers,
          path: '/coa',
          perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT', 'LOCK_ACCOUNT'],
          subItems: [
            { name: 'Assets', path: '/coa?type=Asset' },
            { name: 'Liabilities', path: '/coa?type=Liability' },
            { name: 'Revenue', path: '/coa?type=Revenue' },
            { name: 'Expenses', path: '/coa?type=Expense' },
          ],
        },
      ],
    },
    {
      title: 'Transactions',
      items: [
        { name: 'Add Revenue', icon: TrendingUp, path: '/bank-vouchers/revenue/new' },
        { name: 'Add Expense', icon: TrendingDown, path: '/bank-vouchers/expense/new' },
        { name: 'Journal Entry', icon: FileSpreadsheet, path: '/journals' },
        { name: 'Transfer', icon: RefreshCw, path: '/bank-vouchers/transfer/new' },
      ],
    },
    {
      title: 'Reports',
      items: [
        { name: 'Income Statement', icon: BarChart3, path: '/reports?tab=income-statement', perms: ['VIEW_REPORTS'] },
        { name: 'Balance Sheet', icon: PieChart, path: '/reports?tab=balance-sheet', perms: ['VIEW_REPORTS'] },
        { name: 'Cash Flow', icon: Activity, path: '/reports?tab=cash-flow', perms: ['VIEW_REPORTS'] },
        { name: 'Ledger', icon: BookOpen, path: '/ledger' },
        { name: 'Trial Balance', icon: Layers, path: '/reports?tab=trial-balance', perms: ['VIEW_REPORTS'] },
      ],
    },
    {
      title: 'Welfare & Invoices',
      items: [
        { name: 'Beneficiaries', icon: Users, path: '/beneficiaries' },
        { name: 'Donations', icon: Heart, path: '/donations' },
        { name: 'Donation Reports', icon: FileText, path: '/donation-reports' },
        { name: 'Customers', icon: Users, path: '/customers' },
        { name: 'Invoices', icon: FileSpreadsheet, path: '/invoices' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Bank Vouchers', icon: Wallet, path: '/bank-vouchers' },
        { name: 'Revenue Heads', icon: TrendingUp, path: '/revenue-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: 'Expense Heads', icon: TrendingDown, path: '/expense-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: 'Reserved Codes', icon: ShieldCheck, path: '/reserved', perms: ['MANAGE_RESERVED_CODES'] },
        { name: 'Trial Balance Matrix', icon: Layers, path: '/trial-balance-sheet' },
        { name: 'Users & Roles', icon: BadgeCheck, path: '/users-roles', perms: ['MANAGE_USERS', 'MANAGE_ROLES'] },
        { name: 'Audit Trail', icon: History, path: '/audit', perms: ['VIEW_REPORTS', 'MANAGE_USERS'] },
      ],
    },
  ], []);

  const menuItems = useMemo(() => {
    const items = [];
    sidebarSections.forEach(section => {
      section.items.forEach(item => {
        items.push(item);
        if (item.subItems) {
          item.subItems.forEach(sub => {
            items.push({ name: `${item.name} › ${sub.name}`, icon: item.icon, path: sub.path, perms: item.perms });
          });
        }
      });
    });
    return items;
  }, [sidebarSections]);

  const filteredPages = query.trim()
    ? menuItems.filter(item => (!item.perms || hasPerm(item.perms)) && item.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || '?';
  const userName = user?.name || user?.email || 'User';
  const userRole = user?.role || 'Staff';

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Panel ── */}
      <div
        className={`
          print-hidden h-screen flex flex-col transition-all duration-300 ease-in-out relative z-50
          bg-[#0d0f14] border-r border-white/[0.05]
          ${isCollapsed ? 'lg:w-[68px] w-64' : 'w-64'}
          fixed lg:relative
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* Collapse toggle pill */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute top-[22px] -right-[13px] h-6 w-6 rounded-full bg-[#0d0f14] border border-white/10 items-center justify-center text-slate-500 hover:text-slate-200 transition-all cursor-pointer shadow-lg shadow-black/50 z-[60] hover:border-white/20"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* ── Brand Header ── */}
        <div className={`flex-shrink-0 flex items-center gap-3 border-b border-white/[0.05] relative ${isCollapsed ? 'justify-center px-0 py-4' : 'px-4 py-3.5'}`}>
          {/* Logo mark */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <img src={logoImg} alt="KMLWJ" className="w-6 h-6 object-contain brightness-200" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0f14]" />
          </div>

          {/* Brand name — only when expanded */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white tracking-tight leading-none">KMLWJ</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium tracking-wide">Finance ERP</p>
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute right-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search Button ── */}
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-2 py-2.5 flex justify-center' : 'px-3 py-2.5'}`}>
          {isCollapsed ? (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden lg:flex w-10 h-10 items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </button>
          ) : null}
          {!isCollapsed && (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl text-slate-500 hover:text-slate-300 transition-all text-xs cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span className="font-medium">Search...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[9px] font-bold text-slate-600 bg-white/[0.05] border border-white/[0.08] rounded uppercase tracking-wider select-none">
                ⌘K
              </kbd>
            </button>
          )}
          {/* Mobile expanded search */}
          {isCollapsed && (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="lg:hidden w-full flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-slate-500 hover:text-slate-300 transition-all text-xs cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/5 hover:scrollbar-thumb-white/10 ${isCollapsed ? 'px-2 py-1' : 'px-3 py-1'}`}>
          {sidebarSections.map((section, secIdx) => {
            const accent = SECTION_ACCENTS[secIdx] || SECTION_ACCENTS[0];
            const visibleItems = section.items.filter(item => !item.perms || hasPerm(item.perms));
            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx} className={secIdx === 0 ? 'mt-1' : 'mt-4'}>
                {/* Section label */}
                {!isCollapsed ? (
                  <div className="flex items-center gap-2 px-2 mb-1.5">
                    <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${accent.label} select-none`}>
                      {section.title}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                ) : (
                  secIdx > 0 && <div className="h-px bg-white/[0.04] mx-1 mb-2 mt-1" />
                )}

                {/* Items */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isPathActive(item.path);
                    return (
                      <div key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                          className={`
                            flex items-center gap-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group relative select-none
                            ${isCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-2.5 py-2'}
                            ${active
                              ? `${accent.active} border shadow-sm`
                              : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                            }
                          `}
                        >
                          {/* Icon container */}
                          <div className={`
                            flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-150
                            ${isCollapsed ? 'w-6 h-6' : 'w-6 h-6'}
                            ${active ? `${accent.iconBg} border` : 'border border-transparent group-hover:bg-white/[0.05]'}
                          `}>
                            <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${active ? accent.icon : 'text-slate-500 group-hover:text-slate-300'}`} />
                          </div>

                          {/* Label */}
                          {!isCollapsed && (
                            <span className="truncate">{item.name}</span>
                          )}

                          {/* Collapsed tooltip */}
                          {isCollapsed && (
                            <div className="absolute left-[54px] bg-[#1a1d24] text-slate-200 border border-white/10 text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-[100] hidden lg:block">
                              {item.name}
                              <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#1a1d24] border-l border-b border-white/10 rotate-45" />
                            </div>
                          )}
                        </NavLink>

                        {/* Sub-items */}
                        {item.subItems && !isCollapsed && (
                          <div className="ml-5 mt-0.5 mb-0.5 pl-3 border-l border-white/[0.06] space-y-0.5">
                            {item.subItems.map((sub) => {
                              const subActive = isPathActive(sub.path);
                              return (
                                <NavLink
                                  key={sub.path}
                                  to={sub.path}
                                  onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                                  className={`
                                    flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-150 select-none
                                    ${subActive
                                      ? `${accent.icon} bg-white/[0.04]`
                                      : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.03]'
                                    }
                                  `}
                                >
                                  <span className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${subActive ? accent.activeDot : 'bg-slate-700'}`} />
                                  {sub.name}
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── User Profile Footer ── */}
        <div className={`flex-shrink-0 border-t border-white/[0.05] ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {isCollapsed ? (
            <div className="flex justify-center">
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer group relative"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <div className="absolute left-[54px] bg-[#1a1d24] text-slate-200 border border-white/10 text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-[100] hidden lg:block">
                  Sign Out
                  <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#1a1d24] border-l border-b border-white/10 rotate-45" />
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all group">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
                {userInitial}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-300 truncate leading-none mb-0.5">{userName}</p>
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider truncate">{userRole}</p>
              </div>
              {/* Sign out */}
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Global Search Overlay Modal ── */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[10vh] px-4">
          <div
            ref={modalRef}
            className="bg-[#12141a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
          >
            {/* Search input */}
            <div className="relative border-b border-white/[0.06] flex items-center flex-shrink-0">
              <Search className="absolute left-4 h-4 w-4 text-slate-600" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search accounts, pages, transactions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent py-4 pl-12 pr-20 text-slate-200 placeholder-slate-600 focus:outline-none text-sm font-medium"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-14 p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-3.5 px-2 py-1 rounded-lg border border-white/[0.08] hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 text-[9px] font-mono select-none transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                  <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Searching...</span>
                </div>
              )}

              {!loading && !query && (
                <div className="text-center py-14 text-slate-600">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <Search className="h-6 w-6 text-slate-700" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">Search the project</p>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    Query accounts, beneficiaries, donations, journal entries, and navigation views.
                  </p>
                </div>
              )}

              {!loading && query && (
                <>
                  {filteredPages.length === 0 && results.accounts.length === 0 && results.beneficiaries.length === 0 &&
                    results.donations.length === 0 && results.journalEntries.length === 0 &&
                    (!results.customers || results.customers.length === 0) && (!results.invoices || results.invoices.length === 0) && (
                    <div className="text-center py-14">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                        <HelpCircle className="h-6 w-6 text-slate-700" />
                      </div>
                      <p className="text-sm font-semibold text-slate-400 mb-1">No results found</p>
                      <p className="text-xs text-slate-600">Nothing matches "{query}". Try a different keyword.</p>
                    </div>
                  )}

                  {/* Pages */}
                  {filteredPages.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Navigation · {filteredPages.length}
                      </p>
                      <div className="space-y-0.5">
                        {filteredPages.map((page) => (
                          <button
                            key={page.path}
                            onClick={() => { navigate(page.path); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <page.icon className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-300">{page.name}</p>
                                <p className="text-[10px] text-slate-600">Application View</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accounts */}
                  {results.accounts.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Financial Accounts · {results.accounts.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.accounts.map((acc) => (
                          <button
                            key={acc.id}
                            onClick={() => { navigate(`/coa?search=${acc.glCode}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Layers className="h-4 w-4 text-emerald-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{acc.glCode}</span>
                                  <span className="text-xs font-bold text-slate-300">{acc.accountName}</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-0.5">{acc.detailType} · {acc.currency}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Beneficiaries */}
                  {results.beneficiaries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Beneficiaries · {results.beneficiaries.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.beneficiaries.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => { navigate(`/beneficiaries?search=${b.name}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Users className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-300">{b.name}</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">CNIC: {b.cnic || '—'} · {b.mobile || '—'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Donations */}
                  {results.donations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Donations · {results.donations.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.donations.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => { navigate(`/donations?search=${d.remarks || d.amount}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                <Heart className="h-4 w-4 text-rose-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-300">PKR {d.amount.toLocaleString()}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">{d.donationType}</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-0.5">{d.beneficiary?.name || 'Unknown'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Journal Entries */}
                  {results.journalEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Journal Entries · {results.journalEntries.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.journalEntries.map((je) => (
                          <button
                            key={je.id}
                            onClick={() => { navigate(`/journals?search=${je.voucherNo}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{je.voucherNo}</span>
                                  <span className="text-xs font-bold text-slate-300">{je.reference}</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-0.5">{je.status} · {je.postedBy}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customers */}
                  {results.customers?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Customers · {results.customers.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { navigate(`/customers?search=${c.name}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Users className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-300">{c.name}</p>
                                <p className="text-[10px] text-slate-600 mt-0.5">{c.company ? c.company : 'Private Customer'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices */}
                  {results.invoices?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">
                        Invoices · {results.invoices.length}
                      </p>
                      <div className="space-y-0.5">
                        {results.invoices.map((inv) => (
                          <button
                            key={inv.id}
                            onClick={() => { navigate(`/invoices/${inv.id}`); setIsSearchOpen(false); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                <FileSpreadsheet className="h-4 w-4 text-teal-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded">{inv.invoiceNo}</span>
                                  <span className="text-xs font-bold text-slate-300">PKR {inv.total.toLocaleString()}</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-0.5">{inv.customer?.name} · {inv.status}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-white/[0.02] border-t border-white/[0.05] px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-700 font-medium flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded text-slate-600 font-mono">Esc</kbd>
                <span>to close</span>
              </div>
              <span className="text-slate-700">Global search</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
