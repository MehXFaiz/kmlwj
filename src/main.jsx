import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import './i18n'
import App from './App.jsx'

document.documentElement.classList.remove('light');
document.documentElement.classList.add('dark');

// Global fallback for chunk/preload/decoding load errors with loop guard
function handleChunkLoadRecovery() {
  try {
    const key = 'chunk_reload_timestamp';
    const lastReload = parseInt(sessionStorage.getItem(key) || '0', 10);
    const now = Date.now();
    if (now - lastReload > 15000) {
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    } else {
      console.warn('Chunk load error reload loop prevented.');
    }
  } catch (e) {
    window.location.reload();
  }
}

// Vite native preload error event (emitted on dynamic chunk fetch failures)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  handleChunkLoadRecovery();
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || (typeof event.reason === 'string' ? event.reason : '') || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('ERR_CONTENT_DECODING_FAILED') ||
    msg.includes('error loading dynamically imported module')
  ) {
    event.preventDefault();
    handleChunkLoadRecovery();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
