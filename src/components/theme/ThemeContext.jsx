import { createContext, useContext } from 'react';

// Theme is permanently fixed to dark.
export const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => null,
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
