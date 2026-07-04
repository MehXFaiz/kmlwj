import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo, startTransition } from 'react';
import logoImg from '../../assets/logo.png';
import { useAuthStore } from '../../store/authStore';
import { searchService } from '../../services/apiServices';
import { useTranslation } from 'react-i18next';
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
  ChevronDown,
  PieChart,
  Activity,
  RefreshCw,
  LogOut,
  Wallet,
  Calendar,
  Bus,
  Building,
  Gift,
  DollarSign,
  BadgeCheck,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

export const Sidebar = ({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuthStore(
    useShallow((state) => ({ user: state.user, logout: state.logout }))
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Track which items with subItems are expanded
  const [expandedItems, setExpandedItems] = useState({ '/coa': true });

  const toggleExpand = (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    startTransition(() => {
      setExpandedItems(prev => ({ ...prev, [path]: !prev[path] }));
    });
  };

  const handleNavClick = (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    startTransition(() => {
      navigate(path);
      if (setIsMobileOpen) setIsMobileOpen(false);
      if (setIsSearchOpen) setIsSearchOpen(false);
    });
  };

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
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setResults({ accounts: [], beneficiaries: [], donations: [], journalEntries: [], customers: [], invoices: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setIsSearchOpen(false);
    };
    if (isSearchOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchOpen]);

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
      title: t('sidebar.home', 'Home'),
      items: [
        { name: t('sidebar.dashboard', 'Dashboard'), hint: t('sidebar.dashboardHint', 'At a glance overview'), icon: LayoutDashboard, path: '/' },
        { name: t('sidebar.generalLedger', 'General Ledger'), hint: t('sidebar.generalLedgerHint', 'All account entries'), icon: BookOpen, path: '/ledger' },
      ],
    },
    {
      title: t('sidebar.moneyIn', 'Money In'),
      items: [
        { name: t('sidebar.hallBookings', 'Hall Bookings'), hint: t('sidebar.hallBookingsHint', 'Manage hall reservations'), icon: Calendar, path: '/hall-bookings' },
        { name: 'Donations Received', hint: 'Charitable inflow receipts', icon: Heart, path: '/donations-received' },
        { name: 'Donors Directory', hint: 'Manage registered donors', icon: Users, path: '/donors' },
        { name: t('sidebar.membershipFee', 'Membership Fee'), hint: 'Manage member fees and renewals', icon: Building, path: '/membership-fees' },
        { name: t('sidebar.busBooking', 'Bus Booking'), hint: 'Manage bus reservations and trips', icon: Bus, path: '/bus-bookings' },
      ],
    },
    {
      title: t('sidebar.moneyOut', 'Money Out'),
      items: [
        { name: t('sidebar.salaries', 'Salaries'), hint: 'Log salary payouts', icon: Users, path: '/bank-vouchers/expense/new?type=Salary' },
        { name: t('sidebar.rent', 'Rent'), hint: 'Log rent payments', icon: Building, path: '/bank-vouchers/expense/new?type=Rent' },
        { name: t('sidebar.fuel', 'Fuel'), hint: 'Log fuel expenses', icon: Bus, path: '/bank-vouchers/expense/new?type=Fuel' },
        { name: t('sidebar.busRepair', 'Bus Repair'), hint: 'Log bus maintenance costs', icon: Bus, path: '/bank-vouchers/expense/new?type=Bus Repair' },
        { name: t('sidebar.generatorRepair', 'Generator Repair'), hint: 'Log generator maintenance costs', icon: Activity, path: '/bank-vouchers/expense/new?type=Generator Repair' },
        { name: t('sidebar.legalFee', 'Legal Fee'), hint: 'Log legal & professional fees', icon: FileText, path: '/bank-vouchers/expense/new?type=Legal Fee' },
        { name: t('sidebar.medicalDonationDistribution', 'Medical Donation Distribution'), hint: 'Log medical distribution expenses', icon: Heart, path: '/bank-vouchers/expense/new?type=Medical Donation' },
        { name: t('sidebar.zakatDistribution', 'Zakat Distribution'), hint: 'Log Zakat distribution payouts', icon: Gift, path: '/bank-vouchers/expense/new?type=Zakat Distribution' },
        { name: t('sidebar.other', 'Other'), hint: 'Log other miscellaneous payouts', icon: TrendingDown, path: '/bank-vouchers/expense/new?type=Other' },
      ],
    },
    {
      title: t('sidebar.welfare', 'Welfare'),
      items: [
        { name: t('sidebar.peopleWeHelp', 'People We Help'), hint: t('sidebar.peopleWeHelpHint', 'Beneficiary list'), icon: Users, path: '/beneficiaries' },
        { name: 'Donations Given (Disbursements)', hint: 'Financial aid disbursements', icon: Heart, path: '/donations' },
        { name: t('sidebar.donationReports', 'Donation Reports'), hint: t('sidebar.donationReportsHint', 'Monthly summaries'), icon: FileText, path: '/donation-reports' },
      ],
    },
    {
      title: t('sidebar.invoicesClients'),
      items: [
        { name: t('sidebar.customers'), hint: t('sidebar.customersHint'), icon: Users, path: '/customers' },
        { name: t('sidebar.invoices'), hint: t('sidebar.invoicesHint'), icon: FileSpreadsheet, path: '/invoices' },
        { name: t('sidebar.members', 'Community Members'), hint: t('sidebar.membersHint', 'Manage Jamia member registrations & records'), icon: Users, path: '/members' },
      ],
    },
    {
      title: t('sidebar.reports'),
      items: [
        { name: t('sidebar.incomeStatement'), hint: t('sidebar.incomeStatementHint'), icon: BarChart3, path: '/reports?tab=income-statement', perms: ['VIEW_REPORTS'] },
        { name: t('sidebar.balanceSheet'), hint: t('sidebar.balanceSheetHint'), icon: PieChart, path: '/reports?tab=balance-sheet', perms: ['VIEW_REPORTS'] },
        { name: t('sidebar.cashFlow'), hint: t('sidebar.cashFlowHint'), icon: Activity, path: '/reports?tab=cash-flow', perms: ['VIEW_REPORTS'] },
        { name: t('sidebar.generalLedger'), hint: t('sidebar.generalLedgerHint'), icon: BookOpen, path: '/ledger' },
        { name: t('sidebar.trialBalance'), hint: t('sidebar.trialBalanceHint'), icon: Layers, path: '/reports?tab=trial-balance', perms: ['VIEW_REPORTS'] },
      ],
    },
    {
      title: t('sidebar.manualRecords'),
      items: [
        { name: t('sidebar.journalEntries'), hint: t('sidebar.journalEntriesHint'), icon: FileSpreadsheet, path: '/journals' },
      ],
    },
    {
      // Admin-only section
      title: t('sidebar.settingsAdmin'),
      adminOnly: true,
      items: [
        {
          name: t('sidebar.accountStructure'),
          hint: t('sidebar.accountStructureHint'),
          icon: Layers,
          path: '/coa',
          perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT', 'LOCK_ACCOUNT'],
          subItems: [
            { name: t('sidebar.assets'), path: '/coa?type=Asset' },
            { name: t('sidebar.liabilities'), path: '/coa?type=Liability' },
            { name: t('sidebar.revenue'), path: '/coa?type=Revenue' },
            { name: t('sidebar.expenses'), path: '/coa?type=Expense' },
          ],
        },
        { name: t('sidebar.incomeCategories'), hint: t('sidebar.incomeCategoriesHint'), icon: TrendingUp, path: '/revenue-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: t('sidebar.expenseCategories'), hint: t('sidebar.expenseCategoriesHint'), icon: TrendingDown, path: '/expense-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: t('sidebar.systemAccounts'), hint: t('sidebar.systemAccountsHint'), icon: ShieldCheck, path: '/reserved', perms: ['MANAGE_RESERVED_CODES'] },
        { name: t('sidebar.trialBalanceMatrix'), hint: t('sidebar.trialBalanceMatrixHint'), icon: Layers, path: '/trial-balance-sheet', perms: ['VIEW_REPORTS'] },
        { name: t('sidebar.usersAccess'), hint: t('sidebar.usersAccessHint'), icon: BadgeCheck, path: '/users-roles', perms: ['MANAGE_USERS', 'MANAGE_ROLES'] },
        { name: t('sidebar.auditTrail'), hint: t('sidebar.auditTrailHint'), icon: History, path: '/audit', perms: ['VIEW_REPORTS', 'MANAGE_USERS'] },
      ],
    },
  ], [t]);

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Panel ── */}
      <div
        className={`
          print-hidden h-screen bg-slate-900 border-r border-slate-800/60 flex flex-col transition-all duration-300 z-50
          ${isCollapsed ? 'lg:w-16 w-64' : 'w-64'}
          fixed lg:relative
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ boxShadow: '1px 0 0 0 rgba(255,255,255,0.03)' }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => startTransition(() => setIsCollapsed(!isCollapsed))}
          className="hidden lg:flex absolute top-5 -right-3 h-6 w-6 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer shadow-md shadow-black/40 z-[60]"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* ── Brand Header ── */}
        <div className={`h-14 flex-shrink-0 flex items-center border-b border-slate-800/60 relative ${isCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4 gap-3'}`}>
          <img
            src={logoImg}
            alt="KMLWJ Logo"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-slate-50 tracking-tight leading-none">KMLWJ</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium tracking-wide">Finance ERP</p>
            </div>
          )}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute right-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search Button ── */}
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-2 pt-3 pb-1 flex justify-center' : 'px-3 pt-3 pb-1'}`}>
          {isCollapsed ? (
            <>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden lg:flex p-2.5 bg-slate-950/45 hover:bg-slate-950/70 border border-slate-800/85 hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                title="Search (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden w-full flex items-center gap-2 px-3 py-2 bg-slate-950/45 hover:bg-slate-950/70 border border-slate-800/85 rounded-lg text-slate-400 hover:text-slate-200 transition-all text-xs cursor-pointer select-none"
              >
                <Search className="h-4 w-4 text-slate-500" />
                <span>Search...</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/45 hover:bg-slate-950/70 border border-slate-800/85 hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-all text-xs cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-500" />
                <span>Search project...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded uppercase tracking-wider select-none">
                Ctrl K
              </kbd>
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 min-h-0 py-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
          {sidebarSections.map((section, secIdx) => {
            // Hide admin-only sections from non-Super Admin users
            if (section.adminOnly && user?.role !== 'Super Admin') return null;

            const visibleItems = section.items.filter(item => !item.perms || hasPerm(item.perms));
            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx} className={secIdx === 0 ? 'space-y-0.5' : 'mt-5 space-y-0.5'}>
                {/* Section label */}
                {!isCollapsed ? (
                  <h4 className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em] px-2 pb-1 pt-1 select-none">
                    <span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0" />
                    {section.title}
                  </h4>
                ) : (
                  secIdx > 0 && <div className="border-t border-slate-800/40 my-2 mx-1" />
                )}

                {/* Items */}
                {visibleItems.map((item) => {
                  const active = isPathActive(item.path);
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedItems[item.path] ?? false;

                  return (
                    <div key={item.path}>
                      {/* Parent NavLink row */}
                      <div
                        className={`
                          flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative cursor-pointer
                          ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                          ${active
                            ? 'bg-brand-600/12 text-brand-200 font-semibold'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                          }
                        `}
                        onClick={(e) => {
                          if (hasSubItems && !isCollapsed) {
                            toggleExpand(item.path, e);
                          } else {
                            handleNavClick(item.path, e);
                          }
                        }}
                      >
                        {/* Active left indicator */}
                        {active && !isCollapsed && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-400 rounded-r-full" />
                        )}
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold truncate leading-tight">{item.name}</span>
                            {item.hint && (
                              <span className="block text-[10px] text-slate-600 truncate mt-0.5 leading-none">{item.hint}</span>
                            )}
                          </div>
                        )}
                        {isCollapsed && (
                          <span className="truncate lg:hidden">{item.name}</span>
                        )}

                        {/* Caret toggle for items with sub-items */}
                        {hasSubItems && !isCollapsed && (
                          <ChevronDown
                            className={`h-3.5 w-3.5 flex-shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                          />
                        )}

                        {/* Collapsed tooltip */}
                        {isCollapsed && (
                          <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 hidden lg:block">
                            {item.name}
                          </div>
                        )}
                      </div>

                      {/* Sub-items dropdown — only when expanded and not collapsed sidebar */}
                      {hasSubItems && !isCollapsed && isExpanded && (
                        <div className="ml-5 mt-0.5 mb-1 pl-3 border-l border-slate-800/60 space-y-0.5">
                          {item.subItems.map((sub) => {
                            const subActive = isPathActive(sub.path);
                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                onClick={(e) => handleNavClick(sub.path, e)}
                                className={`
                                  flex items-center gap-2.5 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all duration-150 select-none
                                  ${subActive
                                    ? 'text-brand-300 font-semibold bg-brand-500/5'
                                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                                  }
                                `}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${subActive ? 'bg-brand-400' : 'bg-slate-700'}`} />
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
            );
          })}
        </nav>

        {/* ── User Profile Footer ── */}
        <div className={`flex-shrink-0 border-t border-slate-800/80 ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {isCollapsed ? (
            <div className="flex justify-center">
              <button
                onClick={() => startTransition(() => { logout(); navigate('/login'); })}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-all cursor-pointer border border-transparent hover:border-red-900/40 group relative"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <div className="absolute left-12 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 hidden lg:block">
                  Sign Out
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-slate-800/30 border border-slate-800/60 hover:bg-slate-800/50 transition-all">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold shadow-sm">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-300 truncate leading-tight">{userName}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium truncate">{userRole}</p>
              </div>
              <button
                onClick={() => startTransition(() => { logout(); navigate('/login'); })}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-red-950/40 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Global Search Modal ── */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[10vh] px-4 animate-in fade-in duration-200">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
          >
            {/* Search input */}
            <div className="relative border-b border-slate-800/85 flex items-center shrink-0">
              <Search className="absolute left-4 h-4.5 w-4.5 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder={t('sidebar.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent py-4 pl-12 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-12 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-4 px-1.5 py-0.5 rounded border border-slate-800 hover:bg-slate-800 text-slate-500 text-[9px] font-mono select-none transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Searching database...</span>
                </div>
              )}

              {!loading && !query && (
                <div className="text-center py-12 text-slate-500">
                  <Search className="h-10 w-10 mx-auto text-slate-700 mb-3" />
                  <p className="text-sm font-semibold text-slate-400">Search Overall Project</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto text-slate-500">
                    Type above to query ledger accounts, registered beneficiaries, donation vouchers, journals, and dashboard views.
                  </p>
                </div>
              )}

              {!loading && query && (
                <>
                  {filteredPages.length === 0 && results.accounts.length === 0 && results.beneficiaries.length === 0 &&
                    results.donations.length === 0 && results.journalEntries.length === 0 &&
                    (!results.customers || results.customers.length === 0) && (!results.invoices || results.invoices.length === 0) && (
                    <div className="text-center py-12 text-slate-500">
                      <HelpCircle className="h-10 w-10 mx-auto text-slate-700 mb-3" />
                      <p className="text-sm font-semibold text-slate-400">No results found</p>
                      <p className="text-xs mt-1 text-slate-600">Nothing matches "{query}". Try a different keyword.</p>
                    </div>
                  )}

                  {filteredPages.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Navigation Pages ({filteredPages.length})</h4>
                      <div className="space-y-1">
                        {filteredPages.map((page) => (
                          <button key={page.path} onClick={() => handleNavClick(page.path)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center group-hover:bg-amber-900/60 transition-colors">
                                <page.icon className="h-4 w-4 text-amber-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{page.name}</p>
                                <p className="text-[10px] text-slate-500">Application View</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.accounts.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Financial Accounts ({results.accounts.length})</h4>
                      <div className="space-y-1">
                        {results.accounts.map((acc) => (
                          <button key={acc.id} onClick={() => handleNavClick(`/coa?search=${acc.glCode}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-900/60 transition-colors">
                                <Layers className="h-4 w-4 text-emerald-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-900/65 px-1.5 py-0.5 rounded">{acc.glCode}</span>
                                  <span className="text-xs font-bold text-slate-200">{acc.accountName}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{acc.detailType} ({acc.currency}) · {acc.description || 'No memo'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.beneficiaries.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Welfare Beneficiaries ({results.beneficiaries.length})</h4>
                      <div className="space-y-1">
                        {results.beneficiaries.map((b) => (
                          <button key={b.id} onClick={() => handleNavClick(`/beneficiaries?search=${b.name}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-950/60 border border-blue-900/40 flex items-center justify-center group-hover:bg-blue-900/60 transition-colors">
                                <Users className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{b.name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">CNIC: {b.cnic || '—'} · {b.mobile || '—'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.donations.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Donation Vouchers ({results.donations.length})</h4>
                      <div className="space-y-1">
                        {results.donations.map((d) => (
                          <button key={d.id} onClick={() => handleNavClick(`/donations?search=${d.remarks || d.amount}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-rose-950/60 border border-rose-900/40 flex items-center justify-center group-hover:bg-rose-900/60 transition-colors">
                                <Heart className="h-4 w-4 text-rose-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">PKR {d.amount.toLocaleString()}</span>
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase bg-rose-950/65 text-rose-400 border border-rose-900/40">{d.donationType}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{d.beneficiary?.name || 'Unknown'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.journalEntries.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Journal Entries ({results.journalEntries.length})</h4>
                      <div className="space-y-1">
                        {results.journalEntries.map((je) => (
                          <button key={je.id} onClick={() => handleNavClick(`/journals?search=${je.voucherNo}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center group-hover:bg-amber-900/60 transition-colors">
                                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-900/65 px-1.5 py-0.5 rounded">{je.voucherNo}</span>
                                  <span className="text-xs font-bold text-slate-200">{je.reference}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{je.status} · {je.postedBy}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.customers?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Customers ({results.customers.length})</h4>
                      <div className="space-y-1">
                        {results.customers.map((c) => (
                          <button key={c.id} onClick={() => handleNavClick(`/customers?search=${c.name}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center group-hover:bg-amber-900/60 transition-colors">
                                <Users className="h-4 w-4 text-amber-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{c.name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{c.company ? c.company : 'Private Customer'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.invoices?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Sales Invoices ({results.invoices.length})</h4>
                      <div className="space-y-1">
                        {results.invoices.map((inv) => (
                          <button key={inv.id} onClick={() => handleNavClick(`/invoices/${inv.id}`)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-teal-950/60 border border-teal-900/40 flex items-center justify-center group-hover:bg-teal-900/60 transition-colors">
                                <FileSpreadsheet className="h-4 w-4 text-teal-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/70 border border-teal-900/65 px-1.5 py-0.5 rounded">{inv.invoiceNo}</span>
                                  <span className="text-xs font-bold text-slate-200">PKR {inv.total.toLocaleString()}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">{inv.customer?.name} · {inv.status}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-950/45 border-t border-slate-800/80 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-500 font-medium shrink-0">
              <div className="flex items-center gap-1">
                <span>Use</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded">Esc</kbd>
                <span>to close</span>
              </div>
              <span>Overall search query</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
