import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentFiscalYear, useCoaStore } from '../../store/coaStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { notificationRoute, notificationType } from '../../utils/notificationRoutes';
import { Menu, User, Settings, LogOut, ChevronDown, Globe, Bell, X, Check, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

export const Topbar = ({ onMobileMenuToggle }) => {
  const { user, loading, logout } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      logout: state.logout,
    }))
  );
  const { 
    fiscalYear,
    syncFiscalYear,
  } = useCoaStore(
    useShallow((state) => ({
      fiscalYear: state.fiscalYear,
      syncFiscalYear: state.syncFiscalYear,
    }))
  );

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    startPolling,
    stopPolling,
  } = useNotificationStore(
    useShallow((state) => ({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
      markAsRead: state.markAsRead,
      markAllAsRead: state.markAllAsRead,
      removeNotification: state.removeNotification,
      clearAll: state.clearAll,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
    }))
  );

  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);

  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationMenuRef = useRef(null);
  const [currentFiscalYear, setCurrentFiscalYear] = useState(getCurrentFiscalYear);
  
  const { i18n } = useTranslation();
  const language = i18n.language || 'en';

  useEffect(() => {
    const syncCurrentYear = () => {
      const nextYear = syncFiscalYear();
      setCurrentFiscalYear(nextYear);
    };

    syncCurrentYear();
    const intervalId = window.setInterval(syncCurrentYear, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [syncFiscalYear]);

  // Start polling notifications when the component mounts (user is authenticated)
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setNotificationMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayedFiscalYear = fiscalYear === currentFiscalYear ? fiscalYear : currentFiscalYear;

  return (
    <header className="print-hidden bg-slate-900 z-20 shrink-0 relative" style={{ boxShadow: '0 1px 0 0 rgba(255,255,255,0.04), 0 2px 12px 0 rgba(0,0,0,0.35)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-6 md:py-0 md:h-14">
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
            className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#1C120B] via-[#482F1E] to-[#291A10] dark:from-brand-300 dark:via-brand-200 dark:to-brand-400 truncate select-none text-[15px] sm:text-[18px] text-center leading-relaxed"
            style={{
              fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
              lineHeight: 2,
              letterSpacing: '0.01em',
            }}
          >
            کچھی مسلم لوہارواڈھا ویلفیئر جماعت
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <select
            value={displayedFiscalYear}
            onChange={syncFiscalYear}
            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-300 focus:outline-none focus:border-brand-500"
            aria-label="Select fiscal year"
          >
            <option value={displayedFiscalYear}>{`FY ${displayedFiscalYear}`}</option>
          </select>
        </div>

        {/* Right side - Actions & User Menu */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">

          {/* Notification Menu */}
          <div className="relative" ref={notificationMenuRef}>
            <button 
              onClick={() => {
                setNotificationMenuOpen(!notificationMenuOpen);
                setUserMenuOpen(false);
                setLanguageMenuOpen(false);
              }}
              className="relative p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer text-slate-400 hover:text-slate-100"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Notifications</h3>
                    {unreadCount > 0 && (
                      <p className="text-[11px] text-brand-400 mt-0.5">
                        {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 rounded-lg transition-all"
                      >
                        <Check className="h-3 w-3" /> Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={() => clearAll()}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <X className="h-3 w-3" /> Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">No notifications yet</p>
                      <p className="text-[11px] text-slate-500 mt-1">We'll let you know when something important happens</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {notifications.map((notification) => {
                        const type = notificationType(notification);
                        const typeStyles = {
                          success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                          warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                          error:   { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                          info:    { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
                        }[type];
                        const TypeIcon = typeStyles.icon;
                        return (
                          <div
                            key={notification.id}
                            className={`p-3.5 hover:bg-slate-800/50 transition-all cursor-pointer ${!notification.isRead ? 'bg-slate-800/30' : ''}`}
                            onClick={() => {
                              if (!notification.isRead) markAsRead(notification.id);
                              setNotificationMenuOpen(false);
                              navigate(notificationRoute(notification));
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${typeStyles.bg}`}>
                                <TypeIcon className={`h-3.5 w-3.5 ${typeStyles.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {!notification.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0"></span>
                                  )}
                                  <p className="text-xs font-bold text-slate-100 truncate">
                                    {notification.title}
                                  </p>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  {notification.message}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                                  {notification.module && <span className="text-brand-500 mr-1">[{notification.module}]</span>}
                                  {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(notification.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                                className="p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
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
                <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/60">
                  <button
                    onClick={() => { setNotificationMenuOpen(false); navigate('/notifications'); }}
                    className="w-full text-center text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language Menu */}
          <div className="relative" ref={languageMenuRef}>
            <button 
              onClick={() => {
                setLanguageMenuOpen(!languageMenuOpen);
                setUserMenuOpen(false);
                setNotificationMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer text-slate-400 hover:text-slate-100"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">{language === 'en' ? 'EN' : 'UR'}</span>
              <ChevronDown className="h-3 w-3 text-slate-600" />
            </button>

            {languageMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-slate-900 border border-slate-800/80 rounded-xl shadow-2xl shadow-black/50 z-50 p-1 overflow-hidden">
                <button
                  onClick={() => { i18n.changeLanguage('en'); setLanguageMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-all ${language === 'en' ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
                >
                  🇺🇸 &nbsp;English
                </button>
                <button
                  onClick={() => { i18n.changeLanguage('ur'); setLanguageMenuOpen(false); }}
                  className={`w-full text-right px-3 py-2 text-xs font-semibold rounded-lg transition-all ${language === 'ur' ? 'bg-slate-800 text-brand-300' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}
                  style={{ fontFamily: "'Alvi Nastaleeq', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" }}
                  dir="rtl"
                >
                  اردو 🇵🇰
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setLanguageMenuOpen(false);
                setNotificationMenuOpen(false);
              }}
              className="flex items-center gap-2 px-1.5 py-1 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer text-left"
            >
              {loading ? (
                <>
                  <div className="h-7 w-7 rounded-full bg-slate-800 animate-pulse"></div>
                  <div className="hidden xl:flex flex-col gap-1">
                    <div className="h-3 w-20 bg-slate-800 animate-pulse rounded"></div>
                    <div className="h-2 w-12 bg-slate-800 animate-pulse rounded"></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-7 w-7 rounded-full bg-brand-500/25 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-[11px] select-none">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="hidden xl:flex flex-col text-left pr-1">
                    <span className="text-xs font-bold text-slate-100 leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{user?.role || 'User'}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-500 hidden xl:block" />
                </>
              )}
            </button>

            {userMenuOpen && !loading && (
              <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-brand-300 font-bold text-sm select-none shrink-0">
                    {getInitials(user?.name || user?.fullName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-100 truncate leading-none">{user?.name || user?.fullName || 'Operator'}</span>
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email || 'operator@example.com'}</span>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <User className="h-3.5 w-3.5" /> Profile
                  </Link>
                  <Link to="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <User className="h-3.5 w-3.5" /> My Account
                  </Link>
                  <Link to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 rounded-xl transition-all w-full text-left">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </div>
                <div className="p-1.5 border-t border-slate-800/80">
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all w-full text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
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
