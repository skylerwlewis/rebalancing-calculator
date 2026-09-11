/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    open: true,
  },
  build: {
    outDir: 'build',
  },
  resolve: {
    alias: [
      // Vite 8 (Rolldown) does not apply __esModule interop when pre-bundling
      // CJS MUI icon files, causing them to resolve as plain objects instead of
      // React components. The ESM subpath exports are proper ES modules and
      // avoid this CJS interop issue entirely.
      {
        find: /^@mui\/icons-material\/([^/]+)$/,
        replacement: '@mui/icons-material/esm/$1',
      },
    ],
  },
  plugins: [react(), cloudflare()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  }
})
