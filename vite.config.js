import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base para GitHub Pages bajo /torneo-padel/
export default defineConfig({
  base: '/torneo-padel/',
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
});
