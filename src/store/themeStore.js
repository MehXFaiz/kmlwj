import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Available luxury metallic palettes inspired by the logo - Locked to #432921
export const COLOR_PALETTES = [
  {
    id: 'custom',
    name: 'Custom',
    hue: 15,
    saturation: 30,
    swatch: '#432921',
  },
];

/** Applies the chosen palette by writing CSS variables onto :root */
function applyPalette(palette) {
  const root = document.documentElement;

  // Map all brand variables to #432921 and black
  root.style.setProperty('--brand-50',  `#000000`);
  root.style.setProperty('--brand-100', `#000000`);
  root.style.setProperty('--brand-200', `#000000`);
  root.style.setProperty('--brand-300', `#432921`);
  root.style.setProperty('--brand-400', `#432921`);
  root.style.setProperty('--brand-500', `#432921`);
  root.style.setProperty('--brand-600', `#432921`);
  root.style.setProperty('--brand-700', `#432921`);
  root.style.setProperty('--brand-800', `#432921`);
  root.style.setProperty('--brand-900', `#432921`);
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      activePaletteId: 'custom',

      setTheme: (newTheme) => {
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(newTheme);
        set({ theme: newTheme });
      },

      setPalette: (paletteId) => {
        applyPalette();
        set({ activePaletteId: 'custom' });
      },

      /** Called once on app mount to restore the persisted palette and theme */
      initPalette: () => {
        applyPalette();
        set({ activePaletteId: 'custom' });

        // Apply theme classes
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add('dark');
      },
    }),
    {
      name: 'kmlwj-theme',
      partialize: (state) => ({ activePaletteId: state.activePaletteId, theme: state.theme }),
    }
  )
);

