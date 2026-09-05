import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import './i18n'
import App from './App.jsx'

document.documentElement.classList.remove('light');
document.documentElement.classList.add('dark');

// Global fallback for chunk load errors with loop guard
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    event.preventDefault();
    try {
      const key = 'chunk_reload_timestamp';
      const lastReload = parseInt(sessionStorage.getItem(key) || '0', 10);
      const now = Date.now();
      if (now - lastReload > 20000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      } else {
        console.warn('Chunk load error reload loop prevented.');
      }
    } catch (e) {
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
