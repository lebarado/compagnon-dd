import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base relative : l'app fonctionne quel que soit le sous-dossier où elle est servie
// (GitHub Pages aujourd'hui, serveur maison plus tard).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg', 'icone-180.png'],
      manifest: {
        name: 'Compagnon D&D',
        short_name: 'Compagnon',
        description: 'Fiche de personnage et carnet de campagne pour D&D 2024',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#120f0c',
        theme_color: '#120f0c',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'] },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
