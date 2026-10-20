import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/parchment.css';

// Install as an app and keep working on a poor connection (production only: the dev server reloads itself).
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js').catch(() => {});

// Visitor counts (Google Analytics), production only. The page is reported without its
// #fragment: invite links carry the group's keys there, and they must never leave the phone.
if (import.meta.env.PROD) {
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer ??= [];
  // gtag.js reads the arguments object itself, not an array
  // eslint-disable-next-line prefer-rest-params
  const gtag: (...args: unknown[]) => void = function () { w.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-ZQJD4G2W67', { page_location: location.origin + location.pathname });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZQJD4G2W67';
  document.head.append(tag);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
