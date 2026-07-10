import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useThemeStore } from '../../store/themeStore';
import { X, Search, ChevronDown, Laptop, Sun, Moon, Palette, Globe, Menu, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

// 1. AppThemeProvider
export const AppThemeProvider = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);
  return (
    <div className={`app-root ${theme} min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-brand-500/30 selection:text-brand-100`}>
      {children}
    </div>
  );
};

// 2. AppPage
export const AppPage = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen w-full relative overflow-x-hidden ${className}`}>
      {/* Luxury background grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03] bg-[linear-gradient(to_right,#c87a47_1px,transparent_1px),linear-gradient(to_bottom,#c87a47_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      {/* Radial highlight in background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-[0.04] bg-brand-400" />
      <div className="relative z-10 space-y-6">
        {children}
      </div>
    </div>
  );
};

// 3. AppSection
export const AppSection = ({ children, title, className = '' }) => {
  return (
    <section className={`space-y-4 border-l-2 border-brand-500/20 pl-4 py-1 sm:pl-6 ${className}`}>
      {title && (
        <h3 className="text-xs font-bold text-brand-400/80 uppercase tracking-widest select-none">
          {title}
        </h3>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
};

// 4. AppHeader
export const AppHeader = ({ title, description, actions, children }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800/80">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-brand-300 to-brand-500 shrink-0" />
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-2xl pl-4">
            {description}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div className="flex items-center gap-2 sm:self-end shrink-0 pl-4 sm:pl-0">
          {actions || children}
        </div>
      )}
    </div>
  );
};

// 5. AppCard
export const AppCard = ({
  children,
  className = '',
  hover = true,
  glow = false,
  onClick,
  ...props
}) => {
  const isClickable = !!onClick;
  const cardContent = (
    <div
      onClick={onClick}
      className={`
        rounded-xl glass-panel p-5 sm:p-6 border border-slate-800/80 shadow-md relative overflow-hidden transition-all duration-300
        ${hover ? 'glass-panel-hover hover:border-brand-500/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:-translate-y-0.5' : ''}
        ${glow ? 'shadow-[0_0_30px_-5px_rgba(200,122,71,0.15)] border-brand-500/30' : ''}
        ${isClickable ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Decorative metallic top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-500/25 to-transparent" />
      {children}
    </div>
  );

  return isClickable ? (
    <motion.div whileTap={{ scale: 0.995 }}>{cardContent}</motion.div>
  ) : (
    cardContent
  );
};

// 6. AppButton
export const AppButton = React.forwardRef(({
  children,
  className = '',
  variant = 'primary', // primary, secondary, outline, danger, success, ghost
  size = 'md', // sm, md, lg
  type = 'button',
  disabled = false,
  onClick,
  icon: Icon,
  ...props
}, ref) => {
  const baseStyle = "inline-flex items-center justify-center font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none rounded-xl cursor-pointer gap-2";
  
  const variants = {
    primary: "bg-gradient-to-r from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-350 text-slate-950 font-extrabold shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 border border-brand-500/35",
    secondary: "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 shadow-md",
    outline: "bg-transparent hover:bg-brand-500/5 text-brand-400 border border-brand-500/30 hover:border-brand-500/60",
    danger: "bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 shadow-md shadow-red-950/10",
    success: "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-900/50 shadow-md shadow-emerald-950/10",
    ghost: "bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-100 border border-transparent",
  };

  const sizes = {
    sm: "px-3.5 py-1.5 text-xs rounded-lg",
    md: "px-4.5 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3.5 text-base rounded-2xl",
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
});
AppButton.displayName = 'AppButton';

// 7. AppInput
export const AppInput = React.forwardRef(({
  label,
  error,
  description,
  type = 'text',
  className = '',
  id,
  required,
  icon: Icon,
  ...props
}, ref) => {
  const inputId = id || `app-input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-400 tracking-wider uppercase mb-0.5 flex items-center gap-1 select-none"
        >
          {label}
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      
      <div className="relative w-full">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          id={inputId}
          className={`
            w-full px-4 py-2.5 bg-slate-900/50 border rounded-xl text-sm text-slate-100 placeholder:text-slate-600
            focus:outline-none focus:border-brand-500/60 focus:bg-slate-900/80 focus:shadow-[0_0_15px_rgba(200,122,71,0.12)]
            transition-all duration-250 font-medium border-slate-800
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500/55 focus:border-red-500 focus:shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      
      {description && !error && (
        <span className="text-xs text-slate-500 mt-0.5">{description}</span>
      )}
      
      {error && (
        <span className="text-xs text-red-400 font-bold flex items-center gap-1 mt-0.5">
          ⚠️ {error}
        </span>
      )}
    </div>
  );
});
AppInput.displayName = 'AppInput';

// 8. AppBadge
export const AppBadge = ({
  children,
  variant = 'default', // default, success, danger, warning, info, brand, gold, bronze
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors";
  
  const variants = {
    default: "bg-slate-900 text-slate-400 border-slate-800",
    brand: "bg-brand-950/40 text-brand-300 border-brand-800/40",
    gold: "bg-yellow-950/40 text-yellow-300 border-yellow-800/40",
    bronze: "bg-orange-950/40 text-orange-300 border-orange-850/40",
    success: "bg-emerald-950/40 text-emerald-300 border-emerald-800/40",
    danger: "bg-red-950/40 text-red-300 border-red-900/40",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800/40",
    info: "bg-cyan-950/40 text-cyan-300 border-cyan-800/40",
  };

  return (
    <span
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

// 9. AppTable
export const AppTable = ({
  headers = [],
  rows = [],
  className = '',
  renderRow,
  emptyMessage = "No data available",
}) => {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/25 ${className}`}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50">
            {headers.map((h, i) => (
              <th key={i} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-brand-400 select-none">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-5 py-10 text-center text-slate-500 font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : renderRow ? (
            rows.map((row, idx) => renderRow(row, idx))
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-brand-500/5 transition-colors group">
                {Object.values(row).map((val, cellIdx) => (
                  <td key={cellIdx} className="px-5 py-4 text-slate-300 group-hover:text-slate-100 font-medium">
                    {val}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// 10. AppModal
export const AppModal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) => {
  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              relative w-full glass-panel shadow-2xl rounded-2xl border border-slate-800 overflow-hidden z-10
              flex flex-col max-h-[85vh] shadow-brand-500/5
              ${sizes[size] || sizes.md}
              ${className}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
              {title && (
                <h3 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-brand-400" />
                  {title}
                </h3>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 text-slate-350">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 11. AppNavbar
export const AppNavbar = ({ logo, title, user, onMenuToggle, children }) => {
  return (
    <header className="bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="p-2 rounded-lg text-slate-400 hover:text-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
          )}
          {logo && <img src={logo} alt="Logo" className="w-8 h-8 object-contain shrink-0" />}
          {title && <span className="font-bold text-slate-100 tracking-wider text-base uppercase">{title}</span>}
        </div>
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    </header>
  );
};

// 12. AppSidebar
export const AppSidebar = ({ children, className = '' }) => {
  return (
    <aside className={`w-64 border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 ${className}`}>
      {children}
    </aside>
  );
};

// 13. AppStatsCard
export const AppStatsCard = ({
  title,
  value,
  trend, // { type: 'up' | 'down' | 'neutral', label: string }
  icon: Icon,
  className = "",
}) => {
  return (
    <AppCard className={`group relative overflow-hidden ${className}`}>
      {/* Dynamic light glow background for stats */}
      <div className="absolute right-0 top-0 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-[0.03] bg-brand-400 transition-all duration-500 group-hover:scale-150" />
      
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest select-none">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-brand-400 group-hover:text-brand-300 group-hover:border-brand-500/20 group-hover:shadow-[0_0_12px_rgba(200,122,71,0.15)] transition-all duration-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
            trend.type === 'up' 
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
              : trend.type === 'down' 
                ? 'bg-red-950/40 text-red-400 border border-red-900/30'
                : 'bg-slate-900 text-slate-500 border border-slate-800/50'
          }`}>
            {trend.type === 'up' ? '↑' : trend.type === 'down' ? '↓' : '•'} {trend.value || trend.label}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            {trend.label}
          </span>
        </div>
      )}
    </AppCard>
  );
};

// 14. AppEmptyState
export const AppEmptyState = ({
  title = "No matches found",
  description = "Try adjusting your search filters or add a new record.",
  icon: Icon = Search,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-slate-800/60 bg-slate-900/10">
      <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
        <Icon className="h-6 w-6 text-brand-400/70" />
      </div>
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
};

// 15. AppLoader
export const AppLoader = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizes[size] || sizes.md} border-brand-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  );
};

// 16. AppSkeleton
export const AppSkeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`bg-slate-900 animate-pulse rounded-xl ${className}`}
      {...props}
    />
  );
};
