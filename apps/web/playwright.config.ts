import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const DATABASE_URL = process.env.DATABASE_URL_E2E ?? 'postgres://artoholic:artoholic@localhost:5432/artoholic_e2e';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx tsx tests/e2e/prepare-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL, DATABASE_URL_E2E: DATABASE_URL, OTP_HASH_SECRET: 'e2e-only-otp-secret', NODE_ENV: 'production', APP_VERSION: '0.1.0', WEB_IDLE_MINUTES: '60' }
  }
});
