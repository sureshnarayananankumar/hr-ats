import { test as setup, type Browser } from '@playwright/test';
import fs from 'node:fs';
import { ROLES, STATE_DIR, statePath, type Role } from './roles';

/**
 * Signs in once per role and saves the session cookies.
 *
 * Every other spec reuses these, which matters for two reasons:
 *  1. Login is rate-limited to 5 per minute per IP. A suite that signed
 *     in on every test would throttle itself.
 *  2. It is far faster than repeating the login flow.
 *
 * There are exactly five roles and the limit is five per minute, so the
 * logins are paced and a 429 is waited out rather than treated as a
 * failure — the limiter firing is correct behaviour, not a bug.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? '';

setup.skip(
  !PASSWORD,
  'Set E2E_PASSWORD to the SEED_DEFAULT_PASSWORD from your .env to run authenticated tests.',
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signInAndSave(browser: Browser, role: Role, email: string): Promise<void> {
  // Two attempts: the second runs after the rate-limit window rolls over.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/login');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Candidates land in the portal; staff land on the dashboard.
      await page.waitForURL(/\/(dashboard|portal)/, { timeout: 15_000 });
      await context.storageState({ path: statePath(role) });
      await context.close();
      return;
    } catch (error) {
      const message = (await page.getByRole('alert').textContent().catch(() => '')) ?? '';
      await context.close();

      if (attempt === 2) {
        throw new Error(
          `Could not sign in as ${email}: ${message || (error as Error).message}`,
        );
      }

      const throttled = /too many|429|rate/i.test(message);
      console.log(
        `  ${email}: ${throttled ? 'rate limited' : 'sign-in failed'} — retrying in 62s`,
      );
      await sleep(62_000);
    }
  }
}

setup('authenticate every role', async ({ browser }) => {
  // Five paced logins, plus room for one retry window.
  setup.setTimeout(5 * 60_000);
  fs.mkdirSync(STATE_DIR, { recursive: true });

  const entries = Object.entries(ROLES) as Array<[Role, string]>;

  for (const [index, [role, email]] of entries.entries()) {
    await signInAndSave(browser, role, email);

    // Pace the rest so five logins never land inside a single window.
    if (index < entries.length - 1) {
      await sleep(14_000);
    }
  }
});
