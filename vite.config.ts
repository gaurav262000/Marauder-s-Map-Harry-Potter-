import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Every host the page may talk to. Anything else (e.g. an injected script
// trying to send locations elsewhere) is blocked by the browser.
const CONNECT = [
  'https://tiles.openfreemap.org',
  'https://nominatim.openstreetmap.org',
  'https://routing.openstreetmap.de',
  ...(process.env.VITE_MQTT_BROKERS ?? 'wss://broker.hivemq.com:8884/mqtt,wss://broker.emqx.io:8084/mqtt').split(',').map((u) => new URL(u).origin),
];

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  'worker-src blob:',
  'child-src blob:',
  `connect-src 'self' ${CONNECT.join(' ')}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Production builds only: the dev server injects inline scripts for hot reload. */
const csp: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
};

export default defineConfig({
  plugins: [react(), csp],
  base: './',
  // maplibre-gl is one large, already-minified chunk
  build: { chunkSizeWarningLimit: 1500 },
});
