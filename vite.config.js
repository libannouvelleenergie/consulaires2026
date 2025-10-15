import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Référence l'URL de base de votre dépôt GitHub.
// Ceci est CRUCIAL pour le déploiement sur GitHub Pages pour que les assets soient trouvés.
const repoName = 'consulaires2026';
const basePath = `/${repoName}/`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configuration du chemin de base pour le déploiement GitHub Pages
  base: basePath,
});
