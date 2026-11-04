import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Timer, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore, LAST_ACTIVITY_STORAGE_KEY, AUTO_LOGOUT_STORAGE_KEY } from '../../store/authStore';
import { showToast } from '../ui/Toast';

const WARNING_THRESHOLD_MS = 60 * 1000; // Warn 60 seconds before auto-logout

export const AutoLogoutManager = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const autoLogoutMinutes = useAuthStore((state) => state.autoLogoutMinutes);
  const setAutoLogoutMinutes = useAuthStore((state) => state.setAutoLogoutMinutes);
  const logout = useAuthStore((state) => state.logout);

  const [secondsLeft, setSecondsLeft] = useState(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const loggingOutRef = useRef(false);

  const recordActivity = useCallback((force = false) => {
    const now = Date.now();
    // If warning modal is currently visible, require explicit "Stay Signed In" click
    // unless `force` is true, so accidental tiny mouse movements don't dismiss the warning silently.
    if (warningShownRef.current && !force) return;

    if (!force && now - lastActivityRef.current < 2000) return;
    lastActivityRef.current = now;
    warningShownRef.current = false;
    setSecondsLeft(null);

    try {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch (e) {}
  }, []);

  // Sync activity & settings across browser tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (Number.isFinite(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          warningShownRef.current = false;
          setSecondsLeft(null);
        }
      } else if (e.key === AUTO_LOGOUT_STORAGE_KEY && e.newValue !== null) {
        const mins = parseInt(e.newValue, 10);
        if (Number.isFinite(mins) && mins >= 0) {
          setAutoLogoutMinutes(mins);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setAutoLogoutMinutes]);

  // Attach user interaction listeners
  useEffect(() => {
    if (!isAuthenticated || !autoLogoutMinutes || autoLogoutMinutes <= 0) {
      warningShownRef.current = false;
      setSecondsLeft(null);
      return;
    }

    // Initialize baseline activity timestamp
    try {
      const savedTs = parseInt(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || '0', 10);
      const now = Date.now();
      const timeoutMs = autoLogoutMinutes * 60 * 1000;
      if (Number.isFinite(savedTs) && savedTs > 0 && now - savedTs < timeoutMs) {
        lastActivityRef.current = savedTs;
      } else {
        lastActivityRef.current = now;
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      }
    } catch (e) {
      lastActivityRef.current = Date.now();
    }

    const onActivity = () => recordActivity(false);
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const intervalId = window.setInterval(() => {
      if (loggingOutRef.current) return;

      let latestActivity = lastActivityRef.current;
      try {
        const stored = parseInt(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || '0', 10);
        if (Number.isFinite(stored) && stored > latestActivity) {
          latestActivity = stored;
          lastActivityRef.current = stored;
        }
      } catch (e) {}

      const timeoutMs = autoLogoutMinutes * 60 * 1000;
      const elapsedMs = Date.now() - latestActivity;
      const remainingMs = timeoutMs - elapsedMs;

      if (remainingMs <= 0) {
        loggingOutRef.current = true;
        warningShownRef.current = false;
        setSecondsLeft(null);
        showToast('Automatically logged out due to inactivity.', 'warning');
        logout({ reason: 'inactivity' }).finally(() => {
          loggingOutRef.current = false;
        });
      } else if (remainingMs <= WARNING_THRESHOLD_MS) {
        warningShownRef.current = true;
        setSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else if (warningShownRef.current) {
        warningShownRef.current = false;
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, autoLogoutMinutes, recordActivity, logout]);

  if (!isAuthenticated || !autoLogoutMinutes || secondsLeft === null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl shadow-black/80 p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Timer className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-100">
              Auto-Logout Inactivity Warning
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You have been inactive. For your security, your session will automatically sign out in{' '}
              <span className="font-mono font-bold text-amber-400 text-sm">{secondsLeft}s</span>.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, (secondsLeft / 60) * 100))}%` }}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out Now
          </button>
          <button
            type="button"
            onClick={() => recordActivity(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
};
