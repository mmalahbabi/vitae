import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:4173/vitae/', headless: true,
    launchOptions: process.env.VITAE_TEST_CHROMIUM ? {
      executablePath: process.env.VITAE_TEST_CHROMIUM,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'],
    } : {},
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/vitae/', reuseExistingServer: false,
    // Synthetic endpoint is intercepted by each test. Never uses a live account.
    env: { VITE_SUPABASE_URL: 'https://vitae-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'synthetic-test-key' },
  },
});
