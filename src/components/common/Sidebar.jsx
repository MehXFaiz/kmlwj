import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import logoImg from '../../assets/logo.png';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard, 
  Layers, 
  BookOpen, 
  FileSpreadsheet, 
  History, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Users,
  X,
  Heart,
  FileText,
  Receipt,
  PlusCircle,
  MinusCircle,
  Calendar
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const { user } = useAuthStore();
  const showFullBrand = !isCollapsed;

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const hasPerm = (requiredPerms) => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    if (!user.permissions) return false;
    return requiredPerms.some(p => user.permissions.includes(p));
  };

  const navGroups = [
    {
      label: null,
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
      ]
    },
    {
      label: 'TRANSACTIONS',
      items: [
        { name: 'Add Income',       icon: PlusCircle,     path: '/income',    perms: ['RECORD_INCOME'] },
        { name: 'Add Expense',      icon: MinusCircle,    path: '/expenses',  perms: ['RECORD_EXPENSE'] },
        { name: 'Journal Entries',  icon: FileSpreadsheet, path: '/journals', perms: ['POST_JOURNAL'] },
      ]
    },
    {
      label: 'HALL MANAGEMENT',
      items: [
        { name: 'Hall Bookings',    icon: Calendar,       path: '/hall-bookings', perms: ['BOOK_HALL', 'VIEW_HALL_BOOKINGS'] },
        { name: 'Hall Invoices',    icon: Receipt,        path: '/hall-invoices', perms: ['VIEW_INVOICES'] },
      ]
    },
    {
      label: 'DONATIONS',
      items: [
        { name: 'Receive Donation', icon: Heart,          path: '/donations' },
        { name: 'Beneficiaries',    icon: Users,          path: '/beneficiaries' },
        { name: 'Donation Reports', icon: FileText,       path: '/donation-reports', perms: ['VIEW_REPORTS'] },
      ]
    },
    {
      label: 'INVOICES',
      items: [
        { name: 'Invoice System',   icon: Receipt,        path: '/invoices', perms: ['VIEW_INVOICES'] },
      ]
    },
    {
      label: 'REPORTS',
      items: [
        { name: 'Reports',          icon: BarChart3,      path: '/reports',  perms: ['VIEW_REPORTS'] },
        { name: 'General Ledger',   icon: BookOpen,       path: '/ledger',   perms: ['VIEW_REPORTS'] },
        { name: 'Trial Balance',    icon: Layers,         path: '/trial-balance-sheet', perms: ['VIEW_REPORTS'] },
        { name: 'Audit Trail',      icon: History,        path: '/audit',    perms: ['VIEW_REPORTS', 'MANAGE_USERS'] },
      ]
    },
    {
      label: 'SETTINGS',
      adminOnly: true,
      items: [
        { name: 'Chart of Accounts', icon: Layers,        path: '/coa',      perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'LOCK_ACCOUNT'] },
        { name: 'Revenue Heads',     icon: TrendingUp,    path: '/revenue-heads', perms: ['CREATE_ACCOUNT'] },
        { name: 'Expense Heads',     icon: TrendingDown,  path: '/expense-heads', perms: ['CREATE_ACCOUNT'] },
        { name: 'Reserved Codes',    icon: ShieldCheck,   path: '/reserved', perms: ['MANAGE_RESERVED_CODES'] },
        { name: 'Users & Roles',     icon: Users,         path: '/users-roles', perms: ['MANAGE_USERS', 'MANAGE_ROLES'] },
      ]
    }
  ];

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
        h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300
        w-64 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
        fixed lg:relative z-50
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Top Section - Brand */}
      <div className={`flex-shrink-0 flex items-center justify-center border-b border-slate-800/80 bg-slate-900/60 px-4 relative transition-all duration-300 ${isCollapsed ? 'h-16' : 'h-28'}`}>
        <img
          src={logoImg}
          alt="KMLWJ Logo"
          className={`object-contain filter drop-shadow(0 0 8px rgba(99,102,241,0.3)) transition-all duration-300 ${isCollapsed ? 'w-10 h-10' : 'w-20 h-20'}`}
        />
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-4 p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
        {navGroups.map((group, gIdx) => {
          if (group.adminOnly && !(user?.role === 'Super Admin' || user?.role === 'Accountant')) return null;
          
          const visibleItems = group.items.filter(item => !item.perms || hasPerm(item.perms));
          if (visibleItems.length === 0) return null;

          return (
            <div key={gIdx} className="mb-4 last:mb-0">
              {!isCollapsed && group.label && (
                <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 px-3 pt-2 pb-2">
                  {group.label}
                </div>
              )}
              {isCollapsed && group.label && (
                <div className="mx-3 my-2 border-b border-slate-800/80"></div>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                      ${isActive 
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
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Section - Collapse toggle only */}
      <div className="flex-shrink-0 border-t border-slate-800/80">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full hidden lg:flex items-center justify-center p-3 text-slate-600 hover:text-slate-300 hover:bg-slate-800/30 transition-all cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </div></>
  );
};
