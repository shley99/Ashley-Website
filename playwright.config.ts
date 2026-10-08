import { defineConfig } from '@playwright/test';
import path from 'node:path';

const executablePath = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/browser',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    launchOptions: { executablePath },
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'root', use: { baseURL: 'http://127.0.0.1:4450/' } },
    { name: 'pages', use: { baseURL: 'http://127.0.0.1:4451/Ashley-Website/' } },
  ],
  webServer: [
    { command: 'node run.mjs astro preview --ignore-lock --host 127.0.0.1 --port 4450 --outDir dist', url: 'http://127.0.0.1:4450/', reuseExistingServer: false, timeout: 30_000 },
    { command: 'node run.mjs astro preview --ignore-lock --host 127.0.0.1 --port 4451 --outDir dist-demo --base /Ashley-Website/', url: 'http://127.0.0.1:4451/Ashley-Website/', reuseExistingServer: false, timeout: 30_000 },
  ],
});
