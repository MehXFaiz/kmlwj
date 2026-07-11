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
  const baseStyle = "inline-flex items-center justify-center font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl cursor-pointer";
  
  const variants = {
    primary: "bg-[#482F1E] hover:bg-[#5A3D28] text-white shadow-lg shadow-[#482F1E]/25",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors",
    outline: "bg-transparent hover:bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors",
    danger: "bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 shadow-lg shadow-red-950/20 transition-colors",
    success: "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-900/50 shadow-lg shadow-emerald-950/20 transition-colors",
    ghost: "bg-transparent hover:bg-slate-900 text-slate-300 focus:ring-0 transition-colors",
  };

  const sizes = {
    sm: "px-3.5 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
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
