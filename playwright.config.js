import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', fullyParallel: true,
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173', headless: true, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  reporter: 'list'
});
