import { useEffect } from 'react';

export function showToast(message, opts = {}){
  const id = `toast-${Date.now()}`;
  const container = document.getElementById('global-toasts') || (() => {
    const c = document.createElement('div'); c.id='global-toasts'; c.style.position='fixed'; c.style.right='12px'; c.style.top='12px'; c.style.left='12px'; c.style.zIndex=9999; document.body.appendChild(c); return c;
  })();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'px-4 py-2 mb-2 rounded-md text-sm shadow-lg ml-auto';
  el.style.maxWidth = 'calc(100vw - 24px)';
  el.style.background = opts.type==='error' ? '#3b0b0b' : '#0f172a';
  el.style.color = '#e6edf3';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, opts.duration || 3000);
}

export const ToastPlaceholder = () => {
  useEffect(()=>{ if(!document.getElementById('global-toasts')){ const c=document.createElement('div'); c.id='global-toasts'; c.style.position='fixed'; c.style.right='12px'; c.style.top='12px'; c.style.left='12px'; c.style.zIndex=9999; document.body.appendChild(c);} },[]);
  return null;
}
