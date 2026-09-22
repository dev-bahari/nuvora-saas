import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../../apps/web/components/ui',
  testMatch: '**/ui.test.tsx',
  outputDir: '../../.impeccable/test-results',
  fullyParallel: true,
  workers: 2,
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:3105', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/ui/server.mjs', cwd: '../..', url: 'http://127.0.0.1:3105', reuseExistingServer: false },
});
