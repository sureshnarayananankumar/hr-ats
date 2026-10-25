import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the ALREADY-RUNNING stack, because they
 * need a real database, real sessions and real authorization — not a
 * mocked API. Start it first:
 *
 *   docker compose up -d
 *   $env:E2E_PASSWORD = "<SEED_DEFAULT_PASSWORD from .env>"
 *   npm run e2e
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/**
 * The API lives behind Kong on its own origin. It must be addressed
 * explicitly: a relative /api request would be answered by Vite's SPA
 * fallback with 200 and an HTML body, which silently breaks assertions.
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8000/api';

// Relative to the frontend directory, which is where Playwright runs.
const state = (role: string) => `e2e/.auth/${role}.json`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // the suite shares one database
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    extraHTTPHeaders: {},
  },

  projects: [
    // ---- 1. Public surface: no authentication at all ----
    {
      name: 'public',
      testMatch: /careers\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Candidate traffic is substantially mobile.
    {
      name: 'public-mobile',
      testMatch: /careers\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },

    // ---- 2. Sign in once per role and save the cookies ----
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // ---- 3. Authenticated suites reuse those sessions ----
    {
      name: 'authenticated',
      testMatch: /rbac\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'workflow',
      testMatch: /workflow\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: state('hrAdmin') },
    },
  ],
});

export { API_URL, BASE_URL };
