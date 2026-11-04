import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Converts an ISO 'YYYY-MM-DD' (or Date/ISO timestamp) to 'DD/MM/YYYY' (DATE/MONTH/YEAR).
 */
export const isoToDDMMYYYY = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const clean = val.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
    const datePart = clean.includes('T') ? clean.split('T')[0] : clean;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Converts 'DD/MM/YYYY' to ISO 'YYYY-MM-DD' if valid, or returns null if incomplete/invalid.
 */
export const ddmmyyyyToIso = (display) => {
  if (!display || typeof display !== 'string') return '';
  const clean = display.trim();
  if (!clean) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const maxDays = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDays) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const clampDay = (day, month, year) => {
  const maxDays = new Date(year || 2026, month || 1, 0).getDate();
  return Math.min(maxDays, Math.max(1, day));
};

/**
 * Universal DD/MM/YEAR (DATE/MONTH/YEAR) DateInput component.
 * - Always displays and accepts dates in DD/MM/YYYY format regardless of browser/OS locale.
 * - Emits standard 'YYYY-MM-DD' ISO strings to both controlled `onChange` and `react-hook-form` `register`.
 * - Supports segment highlighting (Date -> Month -> Year), keyboard arrows, direct typing, and native calendar popup.
 */
export const DateInput = forwardRef(({
  type: _ignoredType,
  value,
  defaultValue,
  onChange,
  onBlur,
  name,
  id,
  required,
  disabled,
  min,
  max,
  className = '',
  style,
  placeholder = 'dd/mm/yyyy',
  ...rest
}, forwardedRef) => {
  const initialIso = value !== undefined ? value : (defaultValue ?? '');
  const [displayValue, setDisplayValue] = useState(() => isoToDDMMYYYY(initialIso));
  const [isoValue, setIsoValue] = useState(() => {
    const formatted = isoToDDMMYYYY(initialIso);
    return ddmmyyyyToIso(formatted) || '';
  });

  const textInputRef = useRef(null);
  const hiddenDateRef = useRef(null);
  const pendingRef = useRef(null);

  // Sync when controlled `value` prop changes
  useEffect(() => {
    if (value !== undefined) {
      const nextDisplay = isoToDDMMYYYY(value);
      const nextIso = ddmmyyyyToIso(nextDisplay) || '';
      setDisplayValue(nextDisplay);
      setIsoValue(nextIso);
      if (hiddenDateRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(hiddenDateRef.current, nextIso);
      }
    }
  }, [value]);

  // Attach ref & intercept imperative `.value = ...` mutations from react-hook-form (reset / setValue)
  const setRefs = useCallback((node) => {
    hiddenDateRef.current = node;
    if (node && !node._ddmmyyyyHooked) {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (descriptor && descriptor.get && descriptor.set) {
        Object.defineProperty(node, 'value', {
          configurable: true,
          enumerable: true,
          get() {
            return descriptor.get.call(this);
          },
          set(newVal) {
            descriptor.set.call(this, newVal);
            const nextDisplay = isoToDDMMYYYY(newVal);
            const nextIso = ddmmyyyyToIso(nextDisplay) || '';
            setDisplayValue(nextDisplay);
            setIsoValue(nextIso);
          }
        });
        node._ddmmyyyyHooked = true;
      }
    }
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  const emitChange = useCallback((nextIso) => {
    setIsoValue(nextIso);
    if (hiddenDateRef.current) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(hiddenDateRef.current, nextIso);
    }
    if (onChange) {
      const targetEl = hiddenDateRef.current || { name, value: nextIso };
      const syntheticEvent = {
        target: targetEl,
        currentTarget: targetEl,
        type: 'change',
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      onChange(syntheticEvent);
    }
  }, [onChange, name]);

  const selectSegment = useCallback((segment) => {
    const el = textInputRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if ( document.activeElement !== el ) return;
      if (segment === 'dd') el.setSelectionRange(0, 2);
      else if (segment === 'mm') el.setSelectionRange(3, 5);
      else if (segment === 'yyyy') el.setSelectionRange(6, 10);
    });
  }, []);

  const getActiveSegment = (el) => {
    if (!el) return 'dd';
    const pos = el.selectionStart ?? 0;
    if (pos <= 2) return 'dd';
    if (pos <= 5) return 'mm';
    return 'yyyy';
  };

  const handleClickOrFocus = (e) => {
    pendingRef.current = null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(displayValue)) {
      const seg = getActiveSegment(e.currentTarget);
      selectSegment(seg);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    const isFullDate = /^\d{2}\/\d{2}\/\d{4}$/.test(displayValue);
    if (!isFullDate) return;

    const el = e.currentTarget;
    const seg = getActiveSegment(el);
    const [ddStr, mmStr, yyyyStr] = displayValue.split('/');
    let d = parseInt(ddStr, 10);
    let m = parseInt(mmStr, 10);
    let y = parseInt(yyyyStr, 10);

    if (e.key === 'ArrowRight' || e.key === '/') {
      e.preventDefault();
      pendingRef.current = null;
      if (seg === 'dd') selectSegment('mm');
      else if (seg === 'mm') selectSegment('yyyy');
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pendingRef.current = null;
      if (seg === 'yyyy') selectSegment('mm');
      else if (seg === 'mm') selectSegment('dd');
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      pendingRef.current = null;
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      if (seg === 'dd') {
        const maxD = new Date(y, m, 0).getDate();
        d = ((d - 1 + delta + maxD) % maxD) + 1;
      } else if (seg === 'mm') {
        m = ((m - 1 + delta + 12) % 12) + 1;
        d = clampDay(d, m, y);
      } else {
        y = Math.min(2100, Math.max(1900, y + delta));
        d = clampDay(d, m, y);
      }
      const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
      setDisplayValue(nextDisp);
      const nextIso = ddmmyyyyToIso(nextDisp);
      if (nextIso) emitChange(nextIso);
      selectSegment(seg);
      return;
    }

    // Segment-aware digit typing when a single segment is highlighted
    const selLen = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
    if (/^\d$/.test(e.key) && (selLen === 2 || selLen === 4)) {
      e.preventDefault();
      const digit = parseInt(e.key, 10);

      if (seg === 'dd') {
        if (!pendingRef.current || pendingRef.current.seg !== 'dd') {
          if (digit >= 4) {
            d = clampDay(digit, m, y);
            pendingRef.current = null;
            const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
            setDisplayValue(nextDisp);
            const nextIso = ddmmyyyyToIso(nextDisp);
            if (nextIso) emitChange(nextIso);
            selectSegment('mm');
          } else {
            pendingRef.current = { seg: 'dd', first: digit };
            const tempD = digit === 0 ? 1 : digit;
            const nextDisp = `0${tempD}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
            setDisplayValue(nextDisp);
            selectSegment('dd');
          }
        } else {
          const combined = pendingRef.current.first * 10 + digit;
          d = clampDay(combined === 0 ? 1 : combined, m, y);
          pendingRef.current = null;
          const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
          setDisplayValue(nextDisp);
          const nextIso = ddmmyyyyToIso(nextDisp);
          if (nextIso) emitChange(nextIso);
          selectSegment('mm');
        }
        return;
      }

      if (seg === 'mm') {
        if (!pendingRef.current || pendingRef.current.seg !== 'mm') {
          if (digit >= 2) {
            m = digit;
            d = clampDay(d, m, y);
            pendingRef.current = null;
            const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
            setDisplayValue(nextDisp);
            const nextIso = ddmmyyyyToIso(nextDisp);
            if (nextIso) emitChange(nextIso);
            selectSegment('yyyy');
          } else {
            pendingRef.current = { seg: 'mm', first: digit };
            const tempM = digit === 0 ? 1 : 1;
            const nextDisp = `${String(d).padStart(2, '0')}/0${tempM}/${String(y).padStart(4, '0')}`;
            setDisplayValue(nextDisp);
            selectSegment('mm');
          }
        } else {
          const combined = pendingRef.current.first * 10 + digit;
          m = Math.min(12, Math.max(1, combined));
          d = clampDay(d, m, y);
          pendingRef.current = null;
          const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
          setDisplayValue(nextDisp);
          const nextIso = ddmmyyyyToIso(nextDisp);
          if (nextIso) emitChange(nextIso);
          selectSegment('yyyy');
        }
        return;
      }

      if (seg === 'yyyy') {
        const prevDigits = pendingRef.current?.seg === 'yyyy' ? pendingRef.current.digits : '';
        const nextDigits = (prevDigits + e.key).slice(0, 4);
        if (nextDigits.length < 4) {
          pendingRef.current = { seg: 'yyyy', digits: nextDigits };
          const paddedYear = nextDigits.padStart(4, '2');
          const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${paddedYear}`;
          setDisplayValue(nextDisp);
          selectSegment('yyyy');
        } else {
          pendingRef.current = null;
          y = Math.min(2100, Math.max(1900, parseInt(nextDigits, 10)));
          d = clampDay(d, m, y);
          const nextDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
          setDisplayValue(nextDisp);
          const nextIso = ddmmyyyyToIso(nextDisp);
          if (nextIso) emitChange(nextIso);
          selectSegment('yyyy');
        }
        return;
      }
    }
  };

  const handleTextChange = (e) => {
    pendingRef.current = null;
    const raw = e.target.value;
    if (!raw.trim()) {
      setDisplayValue('');
      emitChange('');
      return;
    }

    // Format digits as DD/MM/YYYY
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }

    setDisplayValue(formatted);

    if (digits.length === 8) {
      let d = parseInt(digits.slice(0, 2), 10);
      let m = Math.min(12, Math.max(1, parseInt(digits.slice(2, 4), 10)));
      let y = Math.min(2100, Math.max(1900, parseInt(digits.slice(4, 8), 10)));
      d = clampDay(d, m, y);
      const validDisp = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y).padStart(4, '0')}`;
      setDisplayValue(validDisp);
      const nextIso = ddmmyyyyToIso(validDisp);
      if (nextIso) emitChange(nextIso);
    }
  };

  const handleBlur = (e) => {
    pendingRef.current = null;
    const parsed = ddmmyyyyToIso(displayValue);
    if (parsed) {
      const normalized = isoToDDMMYYYY(parsed);
      setDisplayValue(normalized);
      if (parsed !== isoValue) {
        emitChange(parsed);
      }
    } else if (!displayValue.trim()) {
      if (isoValue !== '') emitChange('');
    } else {
      // Revert to last valid ISO date if incomplete
      setDisplayValue(isoToDDMMYYYY(isoValue));
    }
    if (onBlur) {
      onBlur({
        ...e,
        target: hiddenDateRef.current || { name, value: isoValue },
        currentTarget: hiddenDateRef.current || { name, value: isoValue }
      });
    }
  };

  const handlePickerChange = (e) => {
    const pickedIso = e.target.value;
    setDisplayValue(isoToDDMMYYYY(pickedIso));
    emitChange(pickedIso);
  };

  const openPicker = () => {
    if (disabled) return;
    const picker = hiddenDateRef.current;
    if (picker) {
      try {
        if (typeof picker.showPicker === 'function') {
          picker.showPicker();
        } else {
          picker.focus();
          picker.click();
        }
      } catch {
        textInputRef.current?.focus();
      }
    }
  };

  // Extract layout width classes for the outer wrapper so inline & full-width layouts both work seamlessly
  const hasFullWidth = /\bw-full\b/.test(className) || style?.width === '100%';
  const widthMatches = className.match(/\b(?:(?:sm:|md:|lg:|xl:)?w-\S+|flex-\S+|min-w-\S+|max-w-\S+)\b/g) || [];
  const wrapperWidthClass = widthMatches.length > 0
    ? widthMatches.join(' ')
    : (hasFullWidth ? 'w-full' : 'inline-block');

  return (
    <div
      className={`relative inline-flex items-center ${wrapperWidthClass}`}
      style={style?.width ? { width: style.width } : undefined}
    >
      <input
        ref={textInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={displayValue}
        onClick={handleClickOrFocus}
        onFocus={handleClickOrFocus}
        onKeyDown={handleKeyDown}
        onChange={handleTextChange}
        onBlur={handleBlur}
        className={`${className} ${hasFullWidth || widthMatches.length > 0 ? 'w-full' : ''} pr-9`}
        style={style}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        title="Open Calendar (DD/MM/YYYY)"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 disabled:opacity-40 transition-colors cursor-pointer p-0.5"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={setRefs}
        type="date"
        name={name}
        value={isoValue}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePickerChange}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          border: 0,
          padding: 0,
          margin: 0
        }}
      />
    </div>
  );
});

DateInput.displayName = 'DateInput';
export default DateInput;
