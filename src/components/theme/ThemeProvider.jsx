import { useEffect } from 'react';
import { ThemeContext } from './ThemeContext';

// Theme is permanently fixed to dark mode.
export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'system');
    root.classList.add('dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};
