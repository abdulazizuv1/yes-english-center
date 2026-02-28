import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/pages/dashboard/',
  build: {
    outDir: '.',
    emptyOutDir: false,
  },
})
