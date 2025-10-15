import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 💡 Correction cruciale pour GitHub Pages (nom du dépôt)
  base: '/consulaires2026/', 
});
