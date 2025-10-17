import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Obtenez le nom du dépôt à partir de l'URL GitHub Pages
// Si l'URL est https://<votre-nom>.github.io/nom-du-depot/, le base est /nom-du-depot/
const REPO_NAME = 'consulaires2026'; // REMPLACEZ 'consulaires2026' par le nom exact de votre dépôt si différent

export default defineConfig({
  // **C'EST CETTE LIGNE QUI FAIT TOUTE LA DIFFÉRENCE**
  base: `/${REPO_NAME}/`, 
  plugins: [react()],
})
