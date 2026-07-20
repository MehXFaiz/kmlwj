import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Menu } from 'lucide-react';

// 1. AppThemeProvider
export const AppThemeProvider = ({ children }) => {
  return (
    <div className="app-root dark min-h-screen bg-black text-[#432921] antialiased selection:bg-[#432921]/30 selection:text-[#432921]">
      {children}
    </div>
  );
};

// 2. AppPage
export const AppPage = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen w-full relative overflow-x-hidden ${className}`}>
      {/* Luxury background grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03] bg-[linear-gradient(to_right,#432921_1px,transparent_1px),linear-gradient(to_bottom,#432921_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="relative z-10 space-y-6">
        {children}
      </div>
    </div>
  );
};

// 3. AppSection
export const AppSection = ({ children, title, className = '' }) => {
  return (
    <section className={`space-y-4 border-l-2 border-[#432921]/20 pl-4 py-1 sm:pl-6 ${className}`}>
      {title && (
        <h3 className="text-xs font-bold text-[#432921]/80 uppercase tracking-widest select-none">
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#432921]/80">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#432921] flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-full bg-[#432921] shrink-0" />
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#432921] font-medium max-w-2xl pl-4">
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
        rounded-xl glass-panel p-5 sm:p-6 border border-[#432921]/80 shadow-md relative overflow-hidden transition-all duration-300
        ${hover ? 'glass-panel-hover hover:border-[#432921]/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:-translate-y-0.5' : ''}
        ${glow ? 'shadow-[0_0_30px_-5px_rgba(67,41,33,0.15)] border-[#432921]/30' : ''}
        ${isClickable ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Decorative metallic top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#432921]/25 to-transparent" />
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
    primary: "bg-[#432921] hover:bg-[#432921]/90 text-black font-extrabold shadow-lg shadow-[#432921]/10 hover:shadow-[#432921]/25 border border-[#432921]/35",
    secondary: "bg-black hover:bg-[#432921]/10 text-[#432921] border border-[#432921]/80 hover:border-[#432921] shadow-md",
    outline: "bg-transparent hover:bg-[#432921]/5 text-[#432921] border border-[#432921]/30 hover:border-[#432921]/60",
    danger: "bg-black hover:bg-[#432921]/10 text-[#432921] border border-[#432921]/50 shadow-md",
    success: "bg-black hover:bg-[#432921]/10 text-[#432921] border border-[#432921]/50 shadow-md",
    ghost: "bg-transparent hover:bg-[#432921]/40 text-[#432921] border border-transparent",
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
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[#432921]" />}
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
          className="block text-xs font-bold text-[#432921] tracking-wider uppercase mb-0.5 flex items-center gap-1 select-none"
        >
          {label}
          {required && <span className="text-[#432921] font-bold">*</span>}
        </label>
      )}
      
      <div className="relative w-full">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#432921]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          id={inputId}
          className={`
            w-full px-4 py-2.5 bg-black/50 border rounded-xl text-sm text-[#432921] placeholder:text-[#432921]/50
            focus:outline-none focus:border-[#432921]/60 focus:bg-black/80
            transition-all duration-250 font-medium border-[#432921]/80
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-[#432921] focus:border-[#432921]' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      
      {description && !error && (
        <span className="text-xs text-[#432921] mt-0.5">{description}</span>
      )}
      
      {error && (
        <span className="text-xs text-[#432921] font-bold flex items-center gap-1 mt-0.5">
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
    default: "bg-black text-[#432921] border-[#432921]/80",
    brand: "bg-black/40 text-[#432921] border-[#432921]/40",
    gold: "bg-black/40 text-[#432921] border-[#432921]/40",
    bronze: "bg-black/40 text-[#432921] border-[#432921]/40",
    success: "bg-black/40 text-[#432921] border-[#432921]/40",
    danger: "bg-black/40 text-[#432921] border-[#432921]/40",
    warning: "bg-black/40 text-[#432921] border-[#432921]/40",
    info: "bg-black/40 text-[#432921] border-[#432921]/40",
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
    <div className={`w-full overflow-x-auto rounded-xl border border-[#432921]/80 bg-black/25 ${className}`}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#432921]/80 bg-black/50">
            {headers.map((h, i) => (
              <th key={i} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#432921] select-none">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#432921]/60">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-5 py-10 text-center text-[#432921] font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : renderRow ? (
            rows.map((row, idx) => renderRow(row, idx))
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-[#432921]/5 transition-colors group">
                {Object.values(row).map((val, cellIdx) => (
                  <td key={cellIdx} className="px-5 py-4 text-[#432921] group-hover:text-[#432921] font-medium">
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              relative w-full glass-panel shadow-2xl rounded-2xl border border-[#432921]/80 overflow-hidden z-10
              flex flex-col max-h-[85vh] shadow-[#432921]/5
              ${sizes[size] || sizes.md}
              ${className}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#432921]/80 bg-black/40 shrink-0">
              {title && (
                <h3 className="text-sm sm:text-base font-bold text-[#432921] uppercase tracking-wide flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-[#432921]" />
                  {title}
                </h3>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#432921] hover:text-[#432921] hover:bg-[#432921]/60 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 text-[#432921]">
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
    <header className="bg-black/90 border-b border-[#432921]/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="p-2 rounded-lg text-[#432921] hover:text-[#432921] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
          )}
          {logo && <img src={logo} alt="Logo" className="w-8 h-8 object-contain shrink-0" />}
          {title && <span className="font-bold text-[#432921] tracking-wider text-base uppercase">{title}</span>}
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
    <aside className={`w-64 border-r border-[#432921]/80 bg-black/95 flex flex-col shrink-0 ${className}`}>
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
      <div className="absolute right-0 top-0 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-[0.03] bg-[#432921] transition-all duration-500 group-hover:scale-150" />
      
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#432921] uppercase tracking-widest select-none">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-[#432921] tracking-tight font-mono">
            {value}
          </h3>
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-black border border-[#432921]/80 flex items-center justify-center text-[#432921] group-hover:text-[#432921] group-hover:border-[#432921]/20 transition-all duration-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md bg-black text-[#432921] border border-[#432921]/30`}>
            {trend.type === 'up' ? '↑' : trend.type === 'down' ? '↓' : '•'} {trend.value || trend.label}
          </span>
          <span className="text-[10px] font-semibold text-[#432921] uppercase tracking-wider">
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
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-[#432921]/60 bg-black/10">
      <div className="h-12 w-12 rounded-2xl bg-black border border-[#432921]/80 flex items-center justify-center text-[#432921] mb-4 shadow-inner">
        <Icon className="h-6 w-6 text-[#432921]/70" />
      </div>
      <h3 className="text-sm font-bold text-[#432921] uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-xs text-[#432921] mt-1.5 max-w-sm leading-relaxed">
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
      <div className={`${sizes[size] || sizes.md} border-[#432921] border-t-transparent rounded-full animate-spin`} />
    </div>
  );
};

// 16. AppSkeleton
export const AppSkeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`bg-black animate-pulse rounded-xl ${className}`}
      {...props}
    />
  );
};
