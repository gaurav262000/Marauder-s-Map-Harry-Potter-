import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // maplibre-gl is one large, already-minified chunk
  build: { chunkSizeWarningLimit: 1500 },
});
