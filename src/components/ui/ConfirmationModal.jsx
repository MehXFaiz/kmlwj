import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, XCircle, Info, Loader2, X, Trash2 } from 'lucide-react';
import { useConfirmStore } from '../../store/confirmStore';

export const useConfirm = () => {
  const showConfirm = useConfirmStore((state) => state.showConfirm);
  return showConfirm;
};

export const ConfirmationModal = () => {
  const {
    isOpen,
    title,
    description,
    details,
    type,
    confirmLabel,
    cancelLabel,
    alertOnly,
    loadingLabel,
    successMessage,
    isLoading,
    error,
    isSuccess,
    handleConfirm,
    handleCancel,
    handleClose,
    isDangerous,
  } = useConfirmStore();

  const modalRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isLoading) return;
        if (isSuccess || error) {
          handleClose();
        } else {
          handleCancel();
        }
      }

      if (e.key === 'Enter') {
        if (document.activeElement?.tagName === 'BUTTON') return;

        if (isSuccess || error) {
          handleClose();
        } else if (!isLoading && !alertOnly) {
          e.preventDefault();
          handleConfirm();
        } else if (alertOnly) {
          e.preventDefault();
          handleClose();
        }
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      if (isSuccess || error || alertOnly) {
        closeBtnRef.current?.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, isSuccess, error, alertOnly, handleConfirm, handleCancel, handleClose]);

  const getHeaderIcon = () => {
    if (isSuccess) {
      return (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950/50 border border-emerald-600/40 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50 border border-red-600/40 text-red-400">
          <XCircle className="h-8 w-8" />
        </div>
      );
    }

    if (isDangerous) {
      return (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/40 border border-red-700/50 text-red-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
      );
    }

    switch (type) {
      case 'success':
        return (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950/50 border border-emerald-600/40 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50 border border-red-600/40 text-red-400">
            <XCircle className="h-8 w-8" />
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-950/40 border border-amber-700/50 text-amber-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
        );
      case 'danger':
        return (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-950/40 border border-red-700/50 text-red-500">
            <Trash2 className="h-8 w-8" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/50 border border-slate-700/50 text-slate-400">
            <Info className="h-8 w-8" />
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-description"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isLoading) return;
              if (isSuccess || error) {
                handleClose();
              } else {
                handleCancel();
              }
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-md bg-slate-950 border border-slate-800/60 rounded-2xl shadow-2xl p-8 overflow-hidden z-10 flex flex-col text-center"
            style={{
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-slate-800/20 blur-3xl pointer-events-none" />

            {!isLoading && (
              <button
                onClick={isSuccess || error ? handleClose : handleCancel}
                className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            <div className="mb-6 mt-2 select-none">
              {getHeaderIcon()}
            </div>

            <h3
              id="confirm-modal-title"
              className="text-lg font-bold text-slate-100 mb-3 select-none"
            >
              {isSuccess ? 'Success' : error ? 'Error' : title}
            </h3>

            <div
              id="confirm-modal-description"
              className="text-sm text-slate-400 leading-relaxed mb-6"
            >
              {isSuccess ? (
                <p className="text-slate-300 font-semibold">{successMessage || 'Operation completed successfully.'}</p>
              ) : error ? (
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 text-left">
                  <p className="text-red-400 text-xs overflow-auto max-h-40 whitespace-pre-wrap font-mono">{error}</p>
                </div>
              ) : (
                <p>{description}</p>
              )}
            </div>

            {!isSuccess && !error && details && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 mb-6 text-left space-y-2.5">
                {Array.isArray(details) ? (
                  <ul className="space-y-2">
                    {details.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-amber-500/80 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  Object.entries(details).map(([key, val]) => {
                    if (!val) return null;

                    if (key.toLowerCase() === 'warning') {
                      return (
                        <div key={key} className="border-t border-slate-700/50 pt-2.5 mt-2.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-red-500 block mb-1">
                            ⚠️ {key}
                          </span>
                          <span className="text-xs text-red-400/90 leading-relaxed block">
                            {val}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="flex justify-between items-start gap-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                          {key}:
                        </span>
                        <span className="text-xs text-slate-200 text-right">
                          {val}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              {isSuccess || error || alertOnly ? (
                <button
                  ref={closeBtnRef}
                  onClick={handleClose}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-600 text-sm font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-transparent border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-slate-100 hover:bg-slate-800/30 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    ref={confirmBtnRef}
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className={`w-full sm:w-1/2 py-3 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer ${
                      isDangerous
                        ? 'bg-red-700 hover:bg-red-600 text-white border border-red-600 hover:border-red-500 shadow-lg shadow-red-900/20'
                        : 'bg-amber-700 hover:bg-amber-600 text-white border border-amber-600 hover:border-amber-500 shadow-lg shadow-amber-900/20'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{loadingLabel}</span>
                      </>
                    ) : (
                      <span>{confirmLabel}</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
