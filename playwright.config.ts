import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config — runs against the Vite dev server in a real headless
 * Chromium instance.  This supplements the Vitest/jsdom unit & integration
 * tests with genuine browser-level tests where MUI DataGrid's layout engine,
 * event system, and cell-edit lifecycle all work exactly as they do in
 * production.
 *
 * Why Playwright instead of jsdom for DataGrid interaction tests:
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
  /* Remote preview URLs are slower than local due to network + loadable hydration;
   * give assertions more headroom. */
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['github'],
  ],
  use: {
    /* When BASE_URL is set (e.g. a Cloudflare Pages preview deployment),
     * point Playwright at that URL instead of the local dev server. */
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
          ? { channel: process.env.PLAYWRIGHT_CHANNEL as 'chrome' }
          : {}),
      },
    },
  ],
  /* Skip starting the dev server when running against a remote URL */
  webServer: process.env.BASE_URL ? undefined : {
    /* Use a dedicated port so this doesn't clash with the normal dev server */
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
