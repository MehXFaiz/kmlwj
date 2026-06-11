import React from 'react';

export const Card = ({
  children,
  className = '',
  hover = false,
  glow = false,
  ...props
}) => {
  return (
    <div
      className={`
        rounded-xl glass-panel border border-slate-800/80 shadow-md p-4 sm:p-6
        ${hover ? 'glass-panel-hover' : ''}
        ${glow ? 'glow-indigo' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`flex flex-col gap-1 mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }) => (
  <h4 className={`text-base font-bold text-slate-100 uppercase tracking-wider ${className}`} {...props}>
    {children}
  </h4>
);

export const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-xs text-slate-400 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-6 pt-4 border-t border-slate-800/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 ${className}`} {...props}>
    {children}
  </div>
);
