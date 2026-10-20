import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles/parchment.css';

// Install as an app and keep working on a poor connection (production only: the dev server reloads itself).
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js').catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
