import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // NOUVEAU: Configure le chemin de base (public base path)
  // Il DOIT correspondre au nom de votre repository GitHub.
  // Ce chemin sera utilisé comme préfixe pour tous les assets compilés (JS, CSS, images).
  base: '/consulaires2026/', 

  // Si vous aviez base: './' cela fonctionnerait aussi, mais l'utilisation du nom du repo est plus sécurisée pour le déploiement sur GitHub Pages.
  // base: './'
})
