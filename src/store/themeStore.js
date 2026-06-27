import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Available accent color palettes — each defines the full brand-* hue/sat
export const COLOR_PALETTES = [
  {
    id: 'indigo',
    name: 'Indigo',
    hue: 224,
    saturation: 89,
    swatch: 'hsl(224, 89%, 48%)',
  },
  {
    id: 'violet',
    name: 'Violet',
    hue: 263,
    saturation: 80,
    swatch: 'hsl(263, 80%, 55%)',
  },
  {
    id: 'rose',
    name: 'Rose',
    hue: 340,
    saturation: 82,
    swatch: 'hsl(340, 82%, 52%)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    hue: 152,
    saturation: 72,
    swatch: 'hsl(152, 72%, 40%)',
  },
  {
    id: 'amber',
    name: 'Amber',
    hue: 38,
    saturation: 92,
    swatch: 'hsl(38, 92%, 50%)',
  },
  {
    id: 'sky',
    name: 'Sky',
    hue: 200,
    saturation: 88,
    swatch: 'hsl(200, 88%, 48%)',
  },
  {
    id: 'teal',
    name: 'Teal',
    hue: 174,
    saturation: 75,
    swatch: 'hsl(174, 75%, 40%)',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia',
    hue: 292,
    saturation: 84,
    swatch: 'hsl(292, 84%, 54%)',
  },
];

/** Applies the chosen palette by writing CSS variables onto :root */
function applyPalette(palette) {
  const root = document.documentElement;
  const { hue: h, saturation: s } = palette;

  root.style.setProperty('--brand-50',  `hsl(${h}, 100%, 97%)`);
  root.style.setProperty('--brand-100', `hsl(${h}, 100%, 92%)`);
  root.style.setProperty('--brand-200', `hsl(${h}, 100%, 84%)`);
  root.style.setProperty('--brand-300', `hsl(${h}, 100%, 73%)`);
  root.style.setProperty('--brand-400', `hsl(${h}, 100%, 61%)`);
  root.style.setProperty('--brand-500', `hsl(${h}, ${s}%, 48%)`);
  root.style.setProperty('--brand-600', `hsl(${h}, ${s}%, 40%)`);
  root.style.setProperty('--brand-700', `hsl(${h}, ${s}%, 32%)`);
  root.style.setProperty('--brand-800', `hsl(${h}, ${s}%, 24%)`);
  root.style.setProperty('--brand-900', `hsl(${h}, ${s}%, 16%)`);
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      activePaletteId: 'indigo',

      setTheme: () => {}, // locked to dark

      setPalette: (paletteId) => {
        const palette = COLOR_PALETTES.find((p) => p.id === paletteId);
        if (!palette) return;
        applyPalette(palette);
        set({ activePaletteId: paletteId });
      },

      /** Called once on app mount to restore the persisted palette */
      initPalette: () => {
        const { activePaletteId } = get();
        const palette = COLOR_PALETTES.find((p) => p.id === activePaletteId);
        if (palette) applyPalette(palette);
      },
    }),
    {
      name: 'kmlwj-theme',
      partialize: (state) => ({ activePaletteId: state.activePaletteId }),
    }
  )
);
