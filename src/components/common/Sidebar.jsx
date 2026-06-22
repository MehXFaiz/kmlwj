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
  Settings, 
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Users,
  LogOut,
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
  RefreshCw
} from 'lucide-react';

export const Sidebar = ({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isPathActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path.includes('?')) {
      return (location.pathname + location.search) === path;
    }
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

  // Debounced API search query
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

  // Close search modal on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    if (isSearchOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchOpen]);

  // Close search modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    if (isSearchOpen) {
      document.addEventListener('keydown', handleEsc);
    }
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
      title: "Core Accounting",
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
            { name: 'Expenses', path: '/coa?type=Expense' }
          ]
        },
      ]
    },
    {
      title: "Transactions",
      items: [
        { name: 'Add Revenue', icon: TrendingUp, path: '/bank-vouchers/revenue/new' },
        { name: 'Add Expense', icon: TrendingDown, path: '/bank-vouchers/expense/new' },
        { name: 'Journal Entry', icon: FileSpreadsheet, path: '/journals' },
        { name: 'Transfer', icon: RefreshCw, path: '/bank-vouchers/transfer/new' },
      ]
    },
    {
      title: "Reports",
      items: [
        { name: 'Income Statement', icon: BarChart3, path: '/reports?tab=income-statement', perms: ['VIEW_REPORTS'] },
        { name: 'Balance Sheet', icon: PieChart, path: '/reports?tab=balance-sheet', perms: ['VIEW_REPORTS'] },
        { name: 'Cash Flow', icon: Activity, path: '/reports?tab=cash-flow', perms: ['VIEW_REPORTS'] },
        { name: 'Ledger', icon: BookOpen, path: '/ledger' },
        { name: 'Trial Balance', icon: Layers, path: '/reports?tab=trial-balance', perms: ['VIEW_REPORTS'] },
      ]
    },
    {
      title: "Welfare & Invoices",
      items: [
        { name: 'Beneficiaries', icon: Users, path: '/beneficiaries' },
        { name: 'Donations', icon: Heart, path: '/donations' },
        { name: 'Donation Reports', icon: FileText, path: '/donation-reports' },
        { name: 'Customers', icon: Users, path: '/customers' },
        { name: 'Invoices', icon: FileSpreadsheet, path: '/invoices' },
      ]
    },
    {
      title: "Administration",
      items: [
        { name: 'Bank Vouchers', icon: FileSpreadsheet, path: '/bank-vouchers' },
        { name: 'Revenue Heads', icon: TrendingUp, path: '/revenue-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: 'Expense Heads', icon: TrendingDown, path: '/expense-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
        { name: 'Reserved Codes', icon: ShieldCheck, path: '/reserved', perms: ['MANAGE_RESERVED_CODES'] },
        { name: 'Trial Balance Matrix', icon: Layers, path: '/trial-balance-sheet' },
        { name: 'Users & Roles', icon: Users, path: '/users-roles', perms: ['MANAGE_USERS', 'MANAGE_ROLES'] },
        { name: 'Audit Trail', icon: History, path: '/audit', perms: ['VIEW_REPORTS', 'MANAGE_USERS'] },
      ]
    }
  ], []);

  const menuItems = useMemo(() => {
    const items = [];
    sidebarSections.forEach(section => {
      section.items.forEach(item => {
        items.push(item);
        if (item.subItems) {
          item.subItems.forEach(sub => {
            items.push({
              name: `${item.name} > ${sub.name}`,
              icon: item.icon,
              path: sub.path,
              perms: item.perms
            });
          });
        }
      });
    });
    return items;
  }, [sidebarSections]);

  const filteredPages = query.trim()
    ? menuItems.filter(item => (!item.perms || hasPerm(item.perms)) && item.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`
          print-hidden
          h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 relative z-50
          ${isCollapsed ? 'lg:w-16 w-64' : 'w-64'}
          fixed lg:relative
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Toggle Arrow Button (Visible on Desktop) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute top-5 -right-3 h-6 w-6 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-855 transition-all cursor-pointer shadow-md shadow-black/40 z-[60]"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Top Section - Brand */}
        <div className={`h-16 flex-shrink-0 flex items-center justify-center border-b border-slate-800/80 bg-slate-900/60 relative ${isCollapsed ? 'lg:px-0' : 'px-4'}`}>
          <img
            src={logoImg}
            alt="KMLWJ Logo"
            className="w-12 h-12 object-contain filter drop-shadow(0 0 6px rgba(99,102,241,0.3))"
          />
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute right-4 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Search Input Button */}
        <div className="px-3 pt-3 pb-1 shrink-0 flex justify-center">
          {isCollapsed ? (
            <>
              {/* Collapsed view search icon button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden lg:flex p-2.5 bg-slate-950/45 hover:bg-slate-950/70 border border-slate-800/85 hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                title="Search project (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
              </button>
              {/* Expanded view fallback for mobile */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/45 hover:bg-slate-950/70 border border-slate-800/85 hover:border-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-all text-xs cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-500" />
                  <span>Search project...</span>
                </div>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded uppercase tracking-wider select-none">
                  Ctrl K
                </kbd>
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
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-slate-900 border border-slate-800 rounded uppercase tracking-wider select-none">
                Ctrl K
              </kbd>
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={`flex-1 min-h-0 py-3 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
          {sidebarSections.map((section, secIdx) => {
            const visibleItems = section.items.filter(item => !item.perms || hasPerm(item.perms));
            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                {/* Section Title */}
                {!isCollapsed && (
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 pt-2 pb-1 select-none">
                    {section.title}
                  </h4>
                )}
                {isCollapsed && secIdx > 0 && (
                  <div className="border-t border-slate-800/40 my-2 mx-1" />
                )}

                {/* Section Items */}
                {visibleItems.map((item) => {
                  const active = isPathActive(item.path);
                  return (
                    <div key={item.path} className="space-y-1">
                      <NavLink
                        to={item.path}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                          ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                          ${active 
                            ? 'bg-brand-600/15 text-brand-300 border-l-2 border-brand-500 font-semibold' 
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                          }
                        `}
                        onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
                        {isCollapsed && (
                          <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 hidden lg:block">
                            {item.name}
                          </div>
                        )}
                      </NavLink>

                      {/* Sub-items (only visible if expanded) */}
                      {item.subItems && !isCollapsed && (
                        <div className="pl-8 space-y-1 mt-1 border-l border-slate-800/50 ml-5">
                          {item.subItems.map((sub) => {
                            const subActive = isPathActive(sub.path);
                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                className={`
                                  flex items-center gap-2 py-1.5 px-2.5 rounded-md text-xs transition-all duration-200 hover:text-slate-100
                                  ${subActive 
                                    ? 'text-brand-300 font-bold bg-brand-500/5' 
                                    : 'text-slate-400 hover:bg-slate-800/30'
                                  }
                                `}
                                onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-750" />
                                <span>{sub.name}</span>
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
      </div>

      {/* Global Search Overlay Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-955/75 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[10vh] px-4 animate-in fade-in duration-200">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
          >
            {/* Search input header */}
            <div className="relative border-b border-slate-800/85 flex items-center shrink-0">
              <Search className="absolute left-4 h-4.5 w-4.5 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search accounts, beneficiaries, donations, journals or views..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent py-4 pl-12 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-12 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-350"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-4 px-1.5 py-0.5 rounded border border-slate-800 hover:bg-slate-800 text-slate-450 hover:text-slate-250 text-[9px] font-mono select-none"
              >
                ESC
              </button>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Searching database...</span>
                </div>
              )}

              {!loading && !query && (
                <div className="text-center py-12 text-slate-500">
                  <Search className="h-10 w-10 mx-auto text-slate-750 mb-3" />
                  <p className="text-sm font-semibold text-slate-450">Search Overall Project</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto text-slate-500">
                    Type above to query ledger accounts, registered beneficiaries, donation vouchers, journals, and dashboard views.
                  </p>
                </div>
              )}

              {!loading && query && (
                <>
                  {/* No results placeholder */}
                  {filteredPages.length === 0 &&
                    results.accounts.length === 0 &&
                    results.beneficiaries.length === 0 &&
                    results.donations.length === 0 &&
                    results.journalEntries.length === 0 &&
                    (!results.customers || results.customers.length === 0) &&
                    (!results.invoices || results.invoices.length === 0) && (
                      <div className="text-center py-12 text-slate-500">
                        <HelpCircle className="h-10 w-10 mx-auto text-slate-750 mb-3" />
                        <p className="text-sm font-semibold text-slate-450">No results found</p>
                        <p className="text-xs mt-1 text-slate-650">
                          We couldn't find anything matching "{query}". Try checking your spelling.
                        </p>
                      </div>
                    )}

                  {/* Pages category */}
                  {filteredPages.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Navigation Pages ({filteredPages.length})</h4>
                      <div className="space-y-1">
                        {filteredPages.map((page) => (
                          <button
                            key={page.path}
                            onClick={() => {
                              navigate(page.path);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-900/60 transition-colors">
                                <page.icon className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{page.name}</p>
                                <p className="text-[10px] text-slate-550">Application View</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-350 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accounts category */}
                  {results.accounts.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Financial Accounts ({results.accounts.length})</h4>
                      <div className="space-y-1">
                        {results.accounts.map((acc) => (
                          <button
                            key={acc.id}
                            onClick={() => {
                              navigate(`/coa?search=${acc.glCode}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-900/60 transition-colors">
                                <Layers className="h-4 w-4 text-emerald-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-emerald-450 bg-emerald-950/70 border border-emerald-900/65 px-1.5 py-0.2 rounded">{acc.glCode}</span>
                                  <span className="text-xs font-bold text-slate-200">{acc.accountName}</span>
                                </div>
                                <p className="text-[10px] text-slate-550 mt-0.5">{acc.detailType} account ({acc.currency}) • {acc.description || 'No memo'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-350 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Beneficiaries category */}
                  {results.beneficiaries.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Welfare Beneficiaries ({results.beneficiaries.length})</h4>
                      <div className="space-y-1">
                        {results.beneficiaries.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => {
                              navigate(`/beneficiaries?search=${b.name}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-950/60 border border-blue-900/40 flex items-center justify-center group-hover:bg-blue-900/60 transition-colors">
                                <Users className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{b.name}</p>
                                <p className="text-[10px] text-slate-555 mt-0.5">
                                  CNIC: {b.cnic || '—'} • Mobile: {b.mobile || '—'} • Address: {b.address || '—'}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-350 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Donations category */}
                  {results.donations.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Donation Vouchers ({results.donations.length})</h4>
                      <div className="space-y-1">
                        {results.donations.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              navigate(`/donations?search=${d.remarks || d.amount}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-rose-950/60 border border-rose-900/40 flex items-center justify-center group-hover:bg-rose-900/60 transition-colors">
                                <Heart className="h-4 w-4 text-rose-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">PKR {d.amount.toLocaleString()}</span>
                                  <span className="text-[9px] font-bold px-1 py-0.2 rounded uppercase bg-rose-950/65 text-rose-400 border border-rose-900/40">{d.donationType}</span>
                                  <span className="text-[9px] font-bold px-1 py-0.2 rounded uppercase bg-slate-950/70 text-slate-400 border border-slate-800">{d.paymentMethod}</span>
                                </div>
                                <p className="text-[10px] text-slate-550 mt-0.5">
                                  Beneficiary: {d.beneficiary?.name || 'Unknown'} • Remarks: {d.remarks || 'No notes'}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-350 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Journal Entries category */}
                  {results.journalEntries.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Journal Entry Ledger Vouchers ({results.journalEntries.length})</h4>
                      <div className="space-y-1">
                        {results.journalEntries.map((je) => (
                          <button
                            key={je.id}
                            onClick={() => {
                              navigate(`/journals?search=${je.voucherNo}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center group-hover:bg-amber-900/60 transition-colors">
                                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-amber-450 bg-amber-950/70 border border-amber-900/65 px-1.5 py-0.2 rounded">{je.voucherNo}</span>
                                  <span className="text-xs font-bold text-slate-200">{je.reference}</span>
                                </div>
                                <p className="text-[10px] text-slate-550 mt-0.5">Posted by: {je.postedBy} • Status: {je.status} • Desc: {je.description || 'No description'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-355 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customers category */}
                  {results.customers?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Customers ({results.customers.length})</h4>
                      <div className="space-y-1">
                        {results.customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              navigate(`/customers?search=${c.name}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-900/60 transition-colors">
                                <Users className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200">{c.name}</p>
                                <p className="text-[10px] text-slate-550 mt-0.5">{c.company ? `Company: ${c.company}` : 'Private Customer'}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-355 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices category */}
                  {results.invoices?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Sales Invoices ({results.invoices.length})</h4>
                      <div className="space-y-1">
                        {results.invoices.map((inv) => (
                          <button
                            key={inv.id}
                            onClick={() => {
                              navigate(`/invoices/${inv.id}`);
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800/40 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-teal-950/60 border border-teal-900/40 flex items-center justify-center group-hover:bg-teal-900/60 transition-colors">
                                <FileSpreadsheet className="h-4 w-4 text-teal-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-teal-450 bg-teal-950/70 border border-teal-900/65 px-1.5 py-0.2 rounded">{inv.invoiceNo}</span>
                                  <span className="text-xs font-bold text-slate-200">PKR {inv.total.toLocaleString()}</span>
                                </div>
                                <p className="text-[10px] text-slate-550 mt-0.5">Billed to: {inv.customer?.name} • Status: {inv.status}</p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-355 transform group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer shortcuts */}
            <div className="bg-slate-950/45 border-t border-slate-800/80 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-550 font-medium shrink-0">
              <div className="flex items-center gap-1">
                <span>Use</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-850 rounded">Esc</kbd>
                <span>to close search</span>
              </div>
              <div>
                <span>Overall search query</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
