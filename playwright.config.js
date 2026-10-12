import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:4175/4e/',
    browserName: 'chromium',
    launchOptions: {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort --base=/4e/',
    url: 'http://127.0.0.1:4175/4e/',
    reuseExistingServer: false,
  },
});
