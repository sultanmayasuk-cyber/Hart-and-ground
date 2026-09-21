import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vercel's preview deployments (any branch but main) show the full site, so it can be checked on real devices
  // before launch; production keeps the coming-soon page until the default in src/main.tsx is flipped
  define: { __PREVIEW__: JSON.stringify(process.env.VERCEL_ENV === 'preview') },
  server: {
    allowedHosts: true, // (a temporary tunnel's hostname, for phone checks)
    host: true, // reachable from a phone on the same Wi-Fi (http://<this Mac's IP>:5173), for testing on real devices
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  preview: { host: true, allowedHosts: true }, // (the built site over a temporary tunnel, for phone checks)
  build: {
    // The lazy-loaded three.js scene chunk is inherently ~1.3 MB.
    chunkSizeWarningLimit: 1500,
  },
})
