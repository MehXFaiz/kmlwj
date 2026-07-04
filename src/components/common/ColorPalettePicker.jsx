import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { useThemeStore, COLOR_PALETTES } from '../../store/themeStore';
import { motion, AnimatePresence } from 'framer-motion';

export const ColorPalettePicker = () => {
  const { activePaletteId, setPalette } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const active = COLOR_PALETTES.find((p) => p.id === activePaletteId);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        id="color-palette-picker-btn"
        onClick={() => setOpen((o) => !o)}
        title="Change accent color"
        className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-slate-100 cursor-pointer"
      >
        <Palette className="h-4 w-4" />
        {/* Active color dot */}
        <span
          className="h-3 w-3 rounded-full border border-white/20 hidden sm:block"
          style={{ background: active?.swatch }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="color-palette-panel"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/50 z-50 p-3"
          >
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2.5 px-0.5">
              Accent Color
            </p>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PALETTES.map((palette) => {
                const isActive = palette.id === activePaletteId;
                return (
                  <button
                    key={palette.id}
                    id={`palette-${palette.id}`}
                    title={palette.name}
                    onClick={() => {
                      setPalette(palette.id);
                      setOpen(false);
                    }}
                    className="group flex flex-col items-center gap-1.5 p-1 rounded-lg transition-all focus:outline-none"
                  >
                    <span
                      className={`h-8 w-8 rounded-full transition-all duration-200 ring-offset-2 ring-offset-slate-900 ${
                        isActive
                          ? 'ring-2 ring-white scale-110 shadow-lg'
                          : 'ring-0 group-hover:ring-1 ring-white/40 group-hover:scale-105'
                      }`}
                      style={{ background: palette.swatch }}
                    />
                    <span className={`text-[9px] font-medium leading-none ${isActive ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-300'}`}>
                      {palette.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
