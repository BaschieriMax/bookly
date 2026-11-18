/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // In development the API runs on :5080; same-origin in production (DEC-010).
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: false },
    },
  },
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
  },
})
