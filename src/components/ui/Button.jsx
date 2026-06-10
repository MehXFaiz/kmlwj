import { forwardRef } from 'react';
import { motion } from 'framer-motion';

export const Button = forwardRef(({
  children,
  className = '',
  variant = 'primary', // primary, secondary, outline, danger, ghost, success
  size = 'md', // sm, md, lg
  type = 'button',
  disabled = false,
  onClick,
  ...props
}, ref) => {
  const baseStyle = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50 disabled:pointer-events-none rounded-md cursor-pointer";
  
  const variants = {
    primary: "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/20 border border-brand-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80",
    outline: "bg-transparent hover:bg-slate-900 text-slate-300 border border-slate-700/80 hover:border-slate-600",
    danger: "bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 shadow-lg shadow-red-950/20",
    success: "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-900/50 shadow-lg shadow-emerald-950/20",
    ghost: "bg-transparent hover:bg-slate-900 text-slate-300 focus:ring-0",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const component = (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      whileTap={disabled ? {} : { scale: 0.98 }}
      className="inline-flex"
    >
      {component}
    </motion.div>
  );
});

Button.displayName = 'Button';
