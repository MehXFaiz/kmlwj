import React from 'react';
import { AlertTriangle, Calendar, X, ArrowRight } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

export default function HallBookingConflictModal({ isOpen, onClose, onChooseAnotherDate, conflictInfo }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/40 p-6 shadow-2xl shadow-red-500/20 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-red-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon */}
        <div className="mb-5 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-lg shadow-red-500/10">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide">
              Hall Already Reserved
            </h3>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mt-0.5">
              Booking Conflict Detected
            </p>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 mb-6 shadow-inner space-y-3">
          <p className="text-sm font-medium text-slate-200 leading-relaxed">
            This hall has already been booked for the selected date. Please choose another date.
          </p>

          {conflictInfo && (
            <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Hall:</span>
                <span className="font-bold text-white">{conflictInfo.hallName || 'Selected Hall'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Reserved Date:</span>
                <span className="font-bold text-red-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3 inline" />
                  {formatDateDDMMYYYY(conflictInfo.bookingDate)}
                </span>
              </div>
              {conflictInfo.bookedBy && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Reserved By:</span>
                  <span className="font-semibold text-slate-200">{conflictInfo.bookedBy}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/3 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all text-center"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onChooseAnotherDate();
              onClose();
            }}
            className="w-full sm:w-2/3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-xs font-bold text-white shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Choose Another Date</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
