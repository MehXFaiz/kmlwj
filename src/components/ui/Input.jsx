import { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  error,
  description,
  type = 'text',
  className = '',
  id,
  required,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}
      
      <input
        ref={ref}
        type={type}
        id={inputId}
        className={`
          w-full px-3 py-2 bg-slate-900/60 border rounded-md text-sm text-slate-100 placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200
          ${error 
            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
            : 'border-slate-800 focus:border-brand-500/50 hover:border-slate-700'
          }
          ${className}
        `}
        {...props}
      />
      
      {description && !error && (
        <span className="text-xs text-slate-500">{description}</span>
      )}
      
      {error && (
        <span className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
          ⚠️ {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
