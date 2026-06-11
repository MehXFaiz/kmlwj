/** Shared responsive layout class strings */

export const pageTitleClass = 'text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight';
export const pageHeaderClass = 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4';
export const pageActionsClass = 'flex flex-wrap items-center gap-2 w-full sm:w-auto';
export const statGridClass = 'grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4';
export const tableShellClass = 'overflow-x-auto -mx-1 px-1';
export const dataTableClass = 'w-full text-left min-w-[640px]';
export const rowActionsClass = 'flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity';
export const modalHeaderClass = 'flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800';
export const modalFooterClass = 'flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-800';
export const modalBodyClass = 'p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto';

export function MobileOnly({ children, className = '' }) {
  return <div className={`md:hidden ${className}`}>{children}</div>;
}

export function DesktopOnly({ children, className = '' }) {
  return <div className={`hidden md:block ${className}`}>{children}</div>;
}
