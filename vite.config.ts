import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    // The lazy-loaded three.js scene chunk is inherently ~1.3 MB.
    chunkSizeWarningLimit: 1500,
  },
})
