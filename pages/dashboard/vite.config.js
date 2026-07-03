import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/pages/dashboard/',
  build: {
    // Build output is committed and served as-is by cPanel, so it lands
    // directly in this folder. The build script wipes assets/ first so
    // stale hashed bundles don't accumulate.
    outDir: '.',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
