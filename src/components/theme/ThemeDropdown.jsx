import { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

export function ThemeDropdown() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const CurrentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors flex items-center justify-center"
        aria-label="Theme switcher"
        title="Theme switcher"
      >
        <CurrentIcon className="h-4.5 w-4.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-slate-900 border border-slate-800 rounded-md shadow-lg overflow-hidden z-50">
          <div className="p-1 flex flex-col gap-0.5">
            <button
              onClick={() => { setTheme('light'); setIsOpen(false); }}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm transition-colors ${
                theme === 'light' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
            <button
              onClick={() => { setTheme('dark'); setIsOpen(false); }}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm transition-colors ${
                theme === 'dark' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
            <button
              onClick={() => { setTheme('system'); setIsOpen(false); }}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm transition-colors ${
                theme === 'system' ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Laptop className="h-4 w-4" /> System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
