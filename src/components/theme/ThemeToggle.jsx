import { useTheme } from './ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

const CYCLE = { light: 'dark', dark: 'system', system: 'light' };
const LABELS = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = ['light', 'dark', 'system'].includes(theme) ? theme : 'dark';

  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;

  return (
    <button
      onClick={() => setTheme(CYCLE[current])}
      className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
      aria-label={`${LABELS[current]} — click to switch`}
      title={LABELS[current]}
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}
