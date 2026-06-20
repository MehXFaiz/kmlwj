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
  Settings, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Users,
  LogOut,
  X,
  Heart,
  FileText,
  Receipt,
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const { user, logout } = useAuthStore();
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

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Chart of Accounts', icon: Layers, path: '/coa', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT', 'LOCK_ACCOUNT'] },
    { name: 'Revenue Heads', icon: TrendingUp, path: '/revenue-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
    { name: 'Expense Heads', icon: TrendingDown, path: '/expense-heads', perms: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT'] },
    { name: 'Reserved Codes', icon: ShieldCheck, path: '/reserved', perms: ['MANAGE_RESERVED_CODES'] },
    { name: 'Beneficiaries', icon: Users, path: '/beneficiaries' },
    { name: 'Donations', icon: Heart, path: '/donations' },
    { name: 'Donation Reports', icon: FileText, path: '/donation-reports' },
    { name: 'Invoice System', icon: Receipt, path: '/invoices' },
    { name: 'Reports', icon: BarChart3, path: '/reports', perms: ['VIEW_REPORTS'] },
    { name: 'Users & Roles', icon: Users, path: '/users-roles', perms: ['MANAGE_USERS', 'MANAGE_ROLES'] },
    { name: 'General Ledger', icon: BookOpen, path: '/ledger' },
    { name: 'Trial Balance Matrix', icon: Layers, path: '/trial-balance-sheet' },
    { name: 'Journal Entries', icon: FileSpreadsheet, path: '/journals' },
    { name: 'Audit Trail', icon: History, path: '/audit', perms: ['VIEW_REPORTS', 'MANAGE_USERS'] },
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
          {menuItems.filter(item => !item.perms || hasPerm(item.perms)).map((item) => (
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
      </nav>

      {/* Bottom Section - User Session, Settings & Toggle */}
      <div className="flex-shrink-0 p-3 border-t border-slate-800/80 bg-slate-950/20">
        
        {/* User profile section */}
        <div className={`mb-3 p-3 rounded-xl bg-slate-950/45 border border-slate-800/80 flex items-center justify-between gap-2 overflow-hidden ${isCollapsed ? 'lg:hidden' : ''}`}>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{user?.fullName || 'Operator'}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/40 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition-all cursor-pointer flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {isCollapsed && (
          <div className="group relative hidden lg:flex justify-center mb-3">
            <button
              onClick={logout}
              className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-slate-800/80 hover:border-red-900/40 transition-all cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
            <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Logout ({user?.fullName || 'Operator'})
            </div>
          </div>
        )}

        {/* System Settings link */}
        <NavLink
          to="/settings"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative mb-2
            ${isActive 
              ? 'bg-slate-800 text-white font-semibold' 
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }
          `}
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>System Settings</span>
          {isCollapsed && (
            <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 hidden lg:block">
              System Settings
            </div>
          )}
        </NavLink>

        {/* Collapsible toggle trigger */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full hidden lg:flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-slate-800/60 cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse Menu</span>
            </div>
          )}
        </button>
      </div>
    </div></>
  );
};
