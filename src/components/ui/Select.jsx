import { forwardRef } from 'react';

export const Select = forwardRef(({
  label,
  error,
  description,
  options = [],
  placeholder,
  className = '',
  id,
  required,
  children,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-400 font-bold">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-slate-100 appearance-none
            focus:outline-none transition-all duration-200 cursor-pointer font-medium
            ${error 
              ? 'border-red-500/60 focus:border-red-500/60' 
              : 'border-slate-800 focus:border-amber-500/60'
            }
            ${className}
          `}
          {...props}
        >
          {placeholder && <option value="" disabled className="bg-slate-950 text-slate-500">{placeholder}</option>}
          {children ? children : options.map((opt) => (
            <option 
              key={opt.value} 
              value={opt.value}
              className="bg-slate-950 text-slate-200 py-2"
            >
              {opt.label}
            </option>
          ))}
        </select>
        
        {/* Custom Chevron Down Arrow */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
      
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

Select.displayName = 'Select';
