import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Free public MQTT relays for groups; set VITE_MQTT_BROKERS to use others. shiftr.io is on
// port 443, which networks that block unusual ports still let through.
const BROKERS = (process.env.VITE_MQTT_BROKERS ??=
  'wss://broker.emqx.io:8084/mqtt,wss://public:public@public.cloud.shiftr.io,wss://test.mosquitto.org:8081/mqtt');

// Every host the page may talk to. Anything else (e.g. an injected script
// trying to send locations elsewhere) is blocked by the browser.
const CONNECT = [
  'https://tiles.openfreemap.org',
  'https://nominatim.openstreetmap.org',
  'https://routing.openstreetmap.de',
  'https://api.open-meteo.com',
  ...BROKERS.split(',').map((u) => new URL(u).origin),
];

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
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
