import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
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
  } = useConfirmStore();

  const modalRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Prevent background scrolling
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

  // Handle keyboard events (ESC, Enter, Focus Trap)
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
        // Prevent enter triggering action multiple times or if button is focused
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

      // Focus trap
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
    
    // Auto focus appropriate action button
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

  // Determine icon and color based on state/type
  const getHeaderIcon = () => {
    if (isSuccess) {
      return (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 glow-emerald">
          <CheckCircle2 className="h-8 w-8" />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-950/40 border border-red-500/30 text-red-400">
          <XCircle className="h-8 w-8" />
        </div>
      );
    }

    switch (type) {
      case 'success':
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 glow-emerald">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-950/40 border border-red-500/30 text-red-400">
            <XCircle className="h-8 w-8" />
          </div>
        );
      case 'info':
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 border border-amber-500/20 text-amber-400">
            <Info className="h-8 w-8" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-950/30 border border-amber-600/30 text-amber-400 glow-amber">
            <AlertTriangle className="h-8 w-8" />
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
          {/* Overlay backdrop */}
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
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Content container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-lg shadow-2xl p-6 overflow-hidden z-10 flex flex-col text-center"
          >
            {/* Ambient gold glow in background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full bg-amber-600/5 blur-3xl pointer-events-none" />

            {/* Close button (top corner, disabled when loading) */}
            {!isLoading && (
              <button
                onClick={isSuccess || error ? handleClose : handleCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Modal Icon */}
            <div className="mb-4 mt-2 select-none">
              {getHeaderIcon()}
            </div>

            {/* Title */}
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-slate-100 uppercase tracking-wider mb-2 select-none"
            >
              {isSuccess ? 'Success' : error ? 'Error' : title}
            </h3>

            {/* Description */}
            <div 
              id="confirm-modal-description" 
              className="text-xs text-slate-400 leading-relaxed mb-5"
            >
              {isSuccess ? (
                <p className="text-slate-300 font-semibold">{successMessage || 'Operation completed successfully.'}</p>
              ) : error ? (
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 text-left">
                  <p className="text-red-400 font-mono text-[11px] overflow-auto max-h-32 whitespace-pre-wrap">{error}</p>
                </div>
              ) : (
                <p>{description}</p>
              )}
            </div>

            {/* Optional details grid */}
            {!isSuccess && !error && details && (
              <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-4 mb-6 text-left space-y-3">
                {Object.entries(details).map(([key, val]) => {
                  if (!val) return null;
                  
                  // Render warning row highlighted
                  if (key.toLowerCase() === 'warning') {
                    return (
                      <div key={key} className="border-t border-slate-800/80 pt-2.5 mt-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 block mb-1">
                          ⚠️ {key}
                        </span>
                        <span className="text-[11px] text-amber-400/90 leading-relaxed block">
                          {val}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {key}:
                      </span>
                      <span className="text-[11px] text-slate-200 font-mono sm:text-right select-all">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              {isSuccess || error || alertOnly ? (
                <button
                  ref={closeBtnRef}
                  onClick={handleClose}
                  className="w-full py-2.5 px-4 rounded-md bg-slate-900 border border-slate-800 text-slate-100 hover:border-amber-600/30 text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="w-full sm:w-1/2 py-2.5 px-4 rounded-md bg-slate-900/40 border border-slate-800 hover:border-amber-600/30 text-slate-400 hover:text-slate-100 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    ref={confirmBtnRef}
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="w-full sm:w-1/2 py-2.5 px-4 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/20 hover:shadow-amber-500/10 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
