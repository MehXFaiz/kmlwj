import React from 'react';

export const SettingsLayout = ({children, title}) => {
  return (
    <div className="p-4 md:p-6">
      <h3 className="text-lg font-bold text-slate-100 mb-3">{title || 'Settings'}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{children}</div>
    </div>
  );
}
