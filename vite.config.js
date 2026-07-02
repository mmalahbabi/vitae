import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Native builds (Capacitor) serve assets from the app bundle root, not a
// GitHub Pages subpath, so they need base: '/' instead of '/vitae/'.
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor'
  const base = isCapacitor ? '/' : '/vitae/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Vitae',
          short_name: 'Vitae',
          description: 'Personal health platform — nutrition, training, protocols, bloodwork.',
          theme_color: '#0E6E66',
          background_color: '#FBFCFC',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    build: {
      outDir: isCapacitor ? 'dist-capacitor' : 'dist',
    },
  }
})
