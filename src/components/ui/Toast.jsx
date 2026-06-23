import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Global singleton event bus for imperative toast calls
   Usage: showToast('Message saved!', 'success')
          showToast('Something went wrong.', 'error')
          showToast('Please fill all fields.', 'warning')
───────────────────────────────────────────────────────── */

const listeners = new Set();

export function showToast(message, type = 'success', duration = 4500) {
  const id = `toast-${Date.now()}-${Math.random()}`;
  const toast = { id, message, type, duration };
  listeners.forEach(fn => fn(toast));
}

/* ─────────────────────────────────────────────────────────
   Individual Toast Item
───────────────────────────────────────────────────────── */
function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const tIn = setTimeout(() => setVisible(true), 20);
    // Auto-dismiss
    const tOut = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 350);
    }, toast.duration || 4500);

    return () => { clearTimeout(tIn); clearTimeout(tOut); };
  }, [toast.id, toast.duration, onRemove]);

  const configs = {
    success: {
      icon: CheckCircle2,
      wrapClass: 'bg-emerald-950 border-emerald-700/60 shadow-emerald-950/60',
      iconClass: 'text-emerald-400',
      textClass: 'text-emerald-100',
    },
    error: {
      icon: XCircle,
      wrapClass: 'bg-red-950 border-red-700/60 shadow-red-950/60',
      iconClass: 'text-red-400',
      textClass: 'text-red-100',
    },
    warning: {
      icon: AlertTriangle,
      wrapClass: 'bg-amber-950 border-amber-700/60 shadow-amber-950/60',
      iconClass: 'text-amber-400',
      textClass: 'text-amber-100',
    },
    info: {
      icon: Info,
      wrapClass: 'bg-slate-800 border-slate-600/60 shadow-slate-900/60',
      iconClass: 'text-blue-400',
      textClass: 'text-slate-100',
    },
  };

  const cfg = configs[toast.type] || configs.info;
  const Icon = cfg.icon;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(24px)',
        transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}
      className={`flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border shadow-2xl ${cfg.wrapClass}`}
      role="alert"
      aria-live="polite"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} />
      <p className={`flex-1 text-sm font-semibold leading-snug ${cfg.textClass}`}>{toast.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 350); }}
        className="flex-shrink-0 mt-0.5 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Toast Container — mount once in App.jsx or main layout
───────────────────────────────────────────────────────── */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => setToasts(prev => [...prev, toast]);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none print:hidden"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}

/* Legacy DOM-based shim — kept for backward compat, now delegates to event bus */
export const ToastPlaceholder = ToastContainer;
