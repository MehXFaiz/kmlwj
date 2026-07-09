import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Building, Hash, AlertCircle, CheckCircle } from 'lucide-react';

const formatHallName = (booking) => {
  if (!booking) return 'N/A';
  const raw = typeof booking === 'string' ? booking : (booking.hallName || booking.hallAccount?.accountName || booking.hallAccount?.name || '');
  if (!raw) return 'N/A';
  const parenMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*\((.+?)\)/i);
  if (parenMatch && parenMatch[1]) return parenMatch[1].trim();
  const dashMatch = raw.match(/(?:Hall Booking Revenue|Hall Booking)\s*[-:]\s*(.+)/i);
  if (dashMatch && dashMatch[1]) return dashMatch[1].trim();
  return raw;
};

export default function HallBookingCalendar({ bookings = [], selectedHallId, onSelectDate, selectedDate }) {
  const [currentDate, setCurrentDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfWeek = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  // Filter active bookings
  const activeBookings = useMemo(() => {
    return bookings.filter(b => 
      b.status !== 'Cancelled' && 
      b.status !== 'Rejected' &&
      (!selectedHallId || b.hallId === selectedHallId || b.hallAccount?.id === selectedHallId || b.hallAccount?.accountId === selectedHallId)
    );
  }, [bookings, selectedHallId]);

  // Map dates (YYYY-MM-DD) to booking objects
  const bookingMap = useMemo(() => {
    const map = {};
    activeBookings.forEach(b => {
      if (!b.programDate) return;
      const dateStr = new Date(b.programDate).toISOString().split('T')[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(b);
    });
    return map;
  }, [activeBookings]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid cells
  const gridCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    gridCells.push(<div key={`empty-${i}`} className="min-h-[70px] p-1 bg-slate-950/20 border border-slate-900/40 rounded-xl opacity-30" />);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    // Format YYYY-MM-DD locally without UTC offset shift
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;

    const dayBookings = bookingMap[dateStr] || [];
    const isBooked = dayBookings.length > 0;
    const isSelected = selectedDate === dateStr;
    const isToday = todayStr === dateStr;

    gridCells.push(
      <div
        key={dateStr}
        onClick={() => !isBooked && onSelectDate && onSelectDate(dateStr)}
        className={`group relative min-h-[76px] p-2 rounded-xl border transition-all flex flex-col justify-between select-none ${
          isBooked
            ? 'bg-red-500/15 border-red-500/50 text-red-200 cursor-not-allowed shadow-sm shadow-red-500/10 hover:bg-red-500/20 hover:border-red-500'
            : isSelected
              ? 'bg-amber-600/30 border-amber-500 text-white ring-2 ring-amber-500/50 cursor-pointer'
              : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 cursor-pointer'
        }`}
      >
        {/* Top bar: Day number and status badge */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
            isToday 
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm' 
              : isSelected
                ? 'bg-amber-500 text-white font-bold'
                : 'text-slate-300'
          }`}>
            {day}
          </span>
          {isBooked ? (
            <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" title="Booked" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-400 opacity-60" title="Available" />
          )}
        </div>

        {/* Bottom indicator text */}
        <div className="mt-1 text-[10px] font-bold tracking-wider uppercase truncate">
          {isBooked ? (
            <span className="text-red-300 flex items-center gap-1">
              🔒 Booked
            </span>
          ) : (
            <span className="text-emerald-400 opacity-80 flex items-center gap-1">
              ✅ Available
            </span>
          )}
        </div>

        {/* Hover Tooltip for Booked Dates */}
        {isBooked && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-slate-900 border border-red-500/40 shadow-2xl shadow-black/80 text-left z-30 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
            <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-red-400 font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="h-3.5 w-3.5" /> Booked Program
            </div>
            {dayBookings.map((b, idx) => (
              <div key={b.id || idx} className="space-y-1.5 text-xs text-slate-300 mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 font-bold text-white truncate">
                  <Building className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{formatHallName(b)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 truncate">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{b.bookerName || 'Anonymous'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3 text-slate-500" />
                    {b.receiptNo ? `HB-${b.receiptNo}` : 'Pending ID'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${
                    b.status === 'POSTED' || b.status === 'Posted'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {b.status || 'Confirmed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900 p-5 shadow-xl space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-wide">
              {monthNames[month]} {year}
            </h3>
            <p className="text-xs text-slate-400">
              {selectedHallId ? 'Showing occupancy for selected hall' : 'Showing occupancy across all halls'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-700 text-slate-300 transition-colors border-l border-slate-700"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Available (Click to Select)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse" /> Booked (Hover for Details)
        </span>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {gridCells}
      </div>
    </div>
  );
}
