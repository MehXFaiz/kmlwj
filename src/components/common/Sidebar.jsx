import { NavLink } from 'react-router-dom';
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
  ShieldCheck,
  BarChart3,
  Users,
  LogOut,
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuthStore();
  
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Chart of Accounts', icon: Layers, path: '/coa' },
    { name: 'Revenue Heads', icon: TrendingUp, path: '/revenue-heads' },
    { name: 'Expense Heads', icon: TrendingDown, path: '/expense-heads' },
    { name: 'Reserved Codes', icon: ShieldCheck, path: '/reserved' },
    { name: 'Reports', icon: BarChart3, path: '/reports' },
    { name: 'Users & Roles', icon: Users, path: '/users-roles' },
    { name: 'General Ledger', icon: BookOpen, path: '/ledger' },
    { name: 'Journal Entries', icon: FileSpreadsheet, path: '/journals' },
    { name: 'Audit Trail', icon: History, path: '/audit' },
  ];

  return (
    <div
      className={`
        relative h-screen bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-30
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Top Section - Brand */}
      <div>
        <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-between bg-slate-900/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/src/assets/kmlwj_logo.svg"
              alt="KMLWJ"
              className="h-9 w-9 rounded-lg flex-shrink-0 shadow-lg shadow-indigo-500/20"
            />
            {!isCollapsed && (
              <span className="font-extrabold text-sm uppercase tracking-widest text-white whitespace-nowrap text-gradient-brand">
                KMLWJ
              </span>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => (
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
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
              {isCollapsed && (
                <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Section - User Session, Settings & Toggle */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/20">
        
        {/* User profile section */}
        {!isCollapsed ? (
          <div className="mb-3 p-3 rounded-xl bg-slate-950/45 border border-slate-800/80 flex items-center justify-between gap-2 overflow-hidden">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{user?.name || 'Operator'}</p>
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
        ) : (
          <div className="group relative flex justify-center mb-3">
            <button
              onClick={logout}
              className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-slate-800/80 hover:border-red-900/40 transition-all cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
            <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Logout ({user?.name || 'Operator'})
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
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">System Settings</span>}
          {isCollapsed && (
            <div className="absolute left-16 bg-slate-950 text-slate-200 border border-slate-800 text-xs px-2.5 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              System Settings
            </div>
          )}
        </NavLink>

        {/* Collapsible toggle trigger */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-slate-800/60 cursor-pointer"
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
    </div>
  );
};
