import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { notificationRoute, notificationType } from '../utils/notificationRoutes';
import { EmptyState } from '../components/ui/EmptyState';
import { Bell, Check, X, Trash2, Search, CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink, RotateCcw } from 'lucide-react';

const TYPE_STYLES = {
  success: { Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Success' },
  warning: { Icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     label: 'Warning' },
  error:   { Icon: AlertCircle,   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Error'   },
  info:    { Icon: Info,          color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',         label: 'Info'    },
};

export const Notifications = () => {
  const navigate = useNavigate();
  const notifications = useNotificationStore(s => s.notifications);
  const unreadCount   = useNotificationStore(s => s.unreadCount);
  const fetchNotifications = useNotificationStore(s => s.fetchNotifications);
  const markAsRead    = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const removeNotification = useNotificationStore(s => s.removeNotification);
  const clearAll = useNotificationStore(s => s.clearAll);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const modules = useMemo(() => {
    const set = new Set();
    notifications.forEach(n => n.module && set.add(n.module));
    return Array.from(set).sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notifications.filter(n => {
      if (q && !(
        (n.title || '').toLowerCase().includes(q) ||
        (n.message || '').toLowerCase().includes(q) ||
        (n.module || '').toLowerCase().includes(q) ||
        (n.actionType || '').toLowerCase().includes(q)
      )) return false;
      if (typeFilter !== 'ALL' && notificationType(n) !== typeFilter.toLowerCase()) return false;
      if (moduleFilter !== 'ALL' && n.module !== moduleFilter) return false;
      if (readFilter === 'UNREAD' && n.isRead) return false;
      if (readFilter === 'READ' && !n.isRead) return false;
      return true;
    });
  }, [notifications, search, typeFilter, moduleFilter, readFilter]);

  const resetFilters = () => {
    setSearch(''); setTypeFilter('ALL'); setModuleFilter('ALL'); setReadFilter('ALL');
  };

  const openNotification = (n) => {
    if (!n.isRead) markAsRead(n.id);
    navigate(notificationRoute(n));
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Every important action across the system, in one feed.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => clearAll()}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 shadow-sm backdrop-blur-md flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, message, module, or action…"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500/50">
            <option value="ALL">All Types</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="INFO">Info</option>
          </select>
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500/50">
            <option value="ALL">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={readFilter} onChange={e => setReadFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500/50">
            <option value="ALL">All</option>
            <option value="UNREAD">Unread only</option>
            <option value="READ">Read only</option>
          </select>
        </div>
        {(search || typeFilter !== 'ALL' || moduleFilter !== 'ALL' || readFilter !== 'ALL') && (
          <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
        <span className="text-xs font-medium text-slate-400 whitespace-nowrap px-1 self-center">
          <strong className="text-slate-200">{filtered.length}</strong> of {notifications.length}
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={notifications.length === 0 ? 'No notifications yet' : 'No notifications match your filters'}
          description={notifications.length === 0
            ? 'System events (creates, updates, deletes, postings, prints) will appear here as they happen.'
            : 'Try adjusting or resetting your filters to see more notifications.'}
          actionLabel={notifications.length > 0 ? 'Reset Filters' : undefined}
          onAction={notifications.length > 0 ? resetFilters : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const type = notificationType(n);
            const ts = TYPE_STYLES[type];
            const TypeIcon = ts.Icon;
            return (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                className={`group relative flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:border-slate-700 hover:bg-slate-900/80 ${
                  n.isRead ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-900/80 border-slate-800 shadow-sm'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${ts.bg}`}>
                  <TypeIcon className={`h-5 w-5 ${ts.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>}
                    <h4 className="text-sm font-bold text-slate-100 truncate">{n.title}</h4>
                    {n.module && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 shrink-0">
                        {n.module}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${ts.bg} ${ts.color}`}>
                      {ts.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{n.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    {n.userName && <span>· {n.userName}</span>}
                    {n.actionType && <span className="uppercase">· {n.actionType}</span>}
                    {n.recordId && <span className="truncate">· #{String(n.recordId).slice(0, 8)}</span>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      title="Mark as read"
                      className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                    title="Delete"
                    className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
