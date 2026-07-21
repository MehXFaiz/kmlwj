import { forwardRef, useEffect, useState } from 'react';
import { sanitizeInputValue } from '../../utils/validation';

export const Input = forwardRef(({
  label,
  error,
  description,
  type = 'text',
  className = '',
  id,
  required,
  validationType,
  maxLength,
  value,
  onChange,
  ...props
}, ref) => {
  const [internalValue, setInternalValue] = useState(value ?? '');

  useEffect(() => {
    setInternalValue(value ?? '');
  }, [value]);

  const handleChange = (e) => {
    const nextValue = sanitizeInputValue(e.target.value, validationType, { maxLength });
    setInternalValue(nextValue);
    if (onChange) {
      const syntheticEvent = { ...e, target: { ...e.target, value: nextValue } };
      onChange(syntheticEvent);
    }
  };
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-400 font-bold">*</span>}
        </label>
      )}
      
      <input
        ref={ref}
        type={type}
        id={inputId}
        value={internalValue}
        onChange={handleChange}
        className={`
          w-full px-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 placeholder:text-slate-600
          focus:outline-none transition-all duration-200 font-medium
          ${error 
            ? 'border-red-500/60 focus:border-red-500/60' 
            : 'border-slate-800 focus:border-amber-500/60'
          }
          ${className}
        `}
        {...props}
      />
      
      {description && !error && (
        <span className="text-xs text-slate-500">{description}</span>
      )}
      
      {error && (
        <span className="text-xs text-red-400 mt-1 block">
          ⚠️ {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
