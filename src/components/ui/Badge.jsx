export const Badge = ({
  children,
  variant = 'default', // default, success, danger, warning, info, brand, purple, orange, rose
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors";
  
  const variants = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    brand: "bg-brand-950/40 text-brand-300 border-brand-800/60",
    success: "bg-emerald-950/40 text-emerald-300 border-emerald-800/60",
    danger: "bg-red-950/40 text-red-300 border-red-900/60",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800/60",
    info: "bg-cyan-950/40 text-cyan-300 border-cyan-800/60",
    purple: "bg-violet-950/40 text-violet-300 border-violet-800/60",
    orange: "bg-orange-950/40 text-orange-300 border-orange-900/60",
    rose: "bg-rose-950/40 text-rose-300 border-rose-900/60",
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

export const AccountTypeBadge = ({ type, className = '', ...props }) => {
  const getVariant = (t) => {
    switch (t) {
      case 'Asset': return 'brand';
      case 'Liability': return 'orange';
      case 'Equity': return 'purple';
      case 'Revenue': return 'success';
      case 'Expense': return 'rose';
      default: return 'default';
    }
  };
  return (
    <Badge variant={getVariant(type)} className={className} {...props}>
      {type}
    </Badge>
  );
};
