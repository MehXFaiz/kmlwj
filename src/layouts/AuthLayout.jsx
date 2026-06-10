import React from 'react';

export const AuthLayout = ({children}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
