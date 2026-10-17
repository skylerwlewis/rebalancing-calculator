import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config. Runs in two modes:
 *
 * 1. Local / CI build: no BASE_URL set → starts the Vite dev server on a
 *    dedicated port (5174) so it doesn't clash with `npm run dev`. No build step
 *    is needed. Locally, just run `npm run test:e2e`.
 *
 * 2. Cloudflare preview: BASE_URL is set by the e2e-preview.yml workflow
 *    to the preview deployment URL. No webServer is started.
 *
 * This supplements the Vitest/jsdom unit tests with genuine browser-level tests
 * where MUI DataGrid's layout engine, event system, and cell-edit lifecycle all
 * work exactly as they do in production:
 *   https://github.com/mui/mui-x/issues/15825 — MUI maintainer recommends
 *   using an actual headless browser (Cypress/Playwright) for DataGrid tests
 *   because jsdom lacks the layout engine that DataGrid relies on.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  /* Fail fast on CI if a test is accidentally left with `.only` */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /* Remote preview URLs are slower than local due to network + hydration;
   * give assertions more headroom. */
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['github'],
  ],
  use: {
    /* When BASE_URL is set (Cloudflare preview), point Playwright at that URL
     * instead of the local webServer below. */
    baseURL: process.env.BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // In CI we can target the runner's preinstalled Chrome and skip
        // downloading Playwright-managed Chromium binaries.
        ...(process.env.CI && process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  /* Skip starting the local server when running against a remote URL */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx vite --port 5174',
        url: 'http://localhost:5174',
        /* On CI always start a fresh server; locally reuse one if already running */
        reuseExistingServer: !process.env.CI,
        /* Suppress auto-open browser tab from vite.config server.open:true */
        env: { BROWSER: 'none' },
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
      },
});
