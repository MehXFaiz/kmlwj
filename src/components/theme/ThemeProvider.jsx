import { ThemeContext } from './ThemeContext';
import { useThemeStore } from '../../store/themeStore';

// Class application (including 'system' resolution) is owned by themeStore —
// this provider only exposes the state via context for useTheme() consumers.
export const ThemeProvider = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
