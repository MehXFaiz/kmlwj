import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext(null);

export const Tabs = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  const currentTab = value !== undefined ? value : activeTab;
  const setTab = onValueChange !== undefined ? onValueChange : setActiveTab;

  return (
    <TabsContext.Provider value={{ currentTab, setTab }}>
      <div className={`flex flex-col w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '' }) => {
  return (
    <div className={`flex gap-1.5 p-1 bg-slate-900/60 border border-slate-800/80 rounded-lg self-start overflow-x-auto ${className}`}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className = '' }) => {
  const { currentTab, setTab } = useContext(TabsContext);
  const isActive = currentTab === value;

  return (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`
        px-3.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0
        ${isActive
          ? 'bg-slate-800 text-white shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = '' }) => {
  const { currentTab } = useContext(TabsContext);
  const isActive = currentTab === value;

  if (!isActive) return null;

  return (
    <div className={`mt-4 w-full animate-in fade-in duration-300 ${className}`}>
      {children}
    </div>
  );
};
