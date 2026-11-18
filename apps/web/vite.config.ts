import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

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
    // Maps are generated for debugging/error tracking but not referenced by the bundles; the
    // Docker image drops them so the source is not published (DEC-031).
    sourcemap: 'hidden',
    // Fonts stay files (cacheable, and allowed by the CSP font-src 'self'): never inline as data:.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    // Playwright specs run against the real stack (npm run e2e), not in jsdom.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
