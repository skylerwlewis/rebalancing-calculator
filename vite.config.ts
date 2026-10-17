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
  plugins: [
    react(),
    // @cloudflare/vite-plugin 1.58.0+ breaks Vitest startup ("There is already a server
    // associated with the config"): https://github.com/cloudflare/workers-sdk/issues/15969
    // Unit tests run in jsdom and don't need the Workers runtime, so skip the plugin under
    // Vitest. Remove this once a fixed release (v2) is adopted.
    ...(process.env.VITEST ? [] : [cloudflare()]),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  }
})
