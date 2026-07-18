import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Available luxury metallic palettes inspired by the logo
export const COLOR_PALETTES = [
  {
    id: 'copper',
    name: 'Mocha Brown',
    hue: 24,
    saturation: 41,
    swatch: '#482F1E',
  },
  {
    id: 'gold',
    name: 'Gold',
    hue: 45,
    saturation: 67,
    swatch: 'hsl(45, 67%, 46%)',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    hue: 23,
    saturation: 43,
    swatch: 'hsl(23, 43%, 46%)',
  },
  {
    id: 'rosegold',
    name: 'Rose Gold',
    hue: 12,
    saturation: 40,
    swatch: 'hsl(12, 40%, 62%)',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    hue: 208,
    saturation: 15,
    swatch: 'hsl(208, 15%, 55%)',
  },
];

/** Applies the chosen palette by writing CSS variables onto :root */
function applyPalette(palette) {
  const root = document.documentElement;
  if (palette.id === 'copper') {
    root.style.setProperty('--brand-50',  '#FAF6F2');
    root.style.setProperty('--brand-100', '#F3EBE3');
    root.style.setProperty('--brand-200', '#E4D3C3');
    root.style.setProperty('--brand-300', '#CFAEA0');
    root.style.setProperty('--brand-400', '#9C735B');
    root.style.setProperty('--brand-500', '#64432C');
    root.style.setProperty('--brand-600', '#482F1E');
    root.style.setProperty('--brand-700', '#382416');
    root.style.setProperty('--brand-800', '#291A10');
    root.style.setProperty('--brand-900', '#1C120B');
    return;
  }
  const { hue: h, saturation: s } = palette;

  root.style.setProperty('--brand-50',  `hsl(${h}, 100%, 97%)`);
  root.style.setProperty('--brand-100', `hsl(${h}, 100%, 93%)`);
  root.style.setProperty('--brand-200', `hsl(${h}, 95%, 85%)`);
  root.style.setProperty('--brand-300', `hsl(${h}, 85%, 72%)`);
  root.style.setProperty('--brand-400', `hsl(${h}, ${s}%, 53%)`);
  root.style.setProperty('--brand-500', `hsl(${h}, ${s + 10}%, 61%)`);
  root.style.setProperty('--brand-600', `hsl(${h}, ${s}%, 46%)`);
  root.style.setProperty('--brand-700', `hsl(${h}, ${s}%, 30%)`);
  root.style.setProperty('--brand-800', `hsl(${h}, ${s}%, 22%)`);
  root.style.setProperty('--brand-900', `hsl(${h}, ${s}%, 15%)`);
}

/** Resolve 'system' to the OS preference; pass 'light'/'dark' through. */
function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'light' ? 'light' : 'dark';
}

/** Swap the html class with a brief 250ms color transition. */
function applyThemeClass(theme) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.add('theme-transition');
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  window.clearTimeout(applyThemeClass._t);
  applyThemeClass._t = window.setTimeout(() => root.classList.remove('theme-transition'), 300);
}

// React to OS theme changes while in 'system' mode
let systemListenerAttached = false;
function ensureSystemListener(get) {
  if (systemListenerAttached) return;
  systemListenerAttached = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (get().theme === 'system') applyThemeClass('system');
  });
}

/** Persist the choice to the server for logged-in users (fire-and-forget). */
async function saveThemeToServer(theme) {
  try {
    const { default: api } = await import('../services/api');
    await api.patch('/api/v1/user-preferences', { themePreference: theme });
  } catch {
    // Guest / offline — localStorage persistence still applies
  }
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // 'light' | 'dark' | 'system'
      activePaletteId: 'copper',

      setTheme: (newTheme, { skipServerSync = false } = {}) => {
        applyThemeClass(newTheme);
        ensureSystemListener(get);
        set({ theme: newTheme });
        if (!skipServerSync) saveThemeToServer(newTheme);
      },

      /** Apply the server-stored preference after login without re-saving it. */
      syncFromServer: (serverTheme) => {
        if (!['light', 'dark', 'system'].includes(serverTheme)) return;
        if (serverTheme === get().theme) return;
        get().setTheme(serverTheme, { skipServerSync: true });
      },

      setPalette: (paletteId) => {
        const palette = COLOR_PALETTES.find((p) => p.id === paletteId);
        if (!palette) return;
        applyPalette(palette);
        set({ activePaletteId: paletteId });
      },

      /** Called once on app mount to restore the persisted palette and theme */
      initPalette: () => {
        const { activePaletteId, theme } = get();
        // Upgrade legacy 'amber' or invalid palettes to 'copper'
        const resolvedId = ['copper', 'gold', 'bronze', 'rosegold', 'platinum'].includes(activePaletteId)
          ? activePaletteId
          : 'copper';

        const palette = COLOR_PALETTES.find((p) => p.id === resolvedId);
        if (palette) {
          applyPalette(palette);
          if (resolvedId !== activePaletteId) set({ activePaletteId: resolvedId });
        }

        applyThemeClass(theme || 'dark');
        ensureSystemListener(get);
      },
    }),
    {
      name: 'kmlwj-theme',
      partialize: (state) => ({ activePaletteId: state.activePaletteId, theme: state.theme }),
    }
  )
);
