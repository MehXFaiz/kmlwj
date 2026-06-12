import { create } from 'zustand';

// Theme is permanently fixed to dark — no persistence needed.
export const useThemeStore = create(() => ({
  theme: 'dark',
  setTheme: () => {}, // no-op: theme is locked
}));
