// Browser tests for the frontend. Run from this folder:
//   npm ci && npx playwright install chromium && npx playwright test
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'specs',
  // three.js and the head scan come from cdn.jsdelivr.net - a cold CDN
  // fetch on a CI runner can take a while.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node serve.js 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
