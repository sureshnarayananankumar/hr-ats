import { expect, test, request as playwrightRequest } from '@playwright/test';

/**
 * Public careers portal — no authentication.
 *
 * The important assertions are about what is NOT present: this is the
 * one surface exposed to the internet, so internal fields must never
 * leak into it.
 */
// Origin only: Playwright resolves a leading-slash path from the
// ORIGIN, so a baseURL ending in /api would be discarded.
const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'http://localhost:8000';

test.describe('Careers portal', () => {
  test('lists published openings', async ({ page }) => {
    await page.goto('/careers');

    await expect(page.getByRole('heading', { name: /build your career/i })).toBeVisible();

    // The live-region count, not the hero copy, which also contains
    // the phrase "open positions".
    await expect(page.getByText(/^\d+ open position\(s\)$/)).toBeVisible();
  });

  test('opens a job detail page and offers to apply', async ({ page }) => {
    await page.goto('/careers');

    const firstJob = page.getByRole('link', { name: /view & apply|engineer|manager|developer/i }).first();
    const jobCard = page.locator('h3').first();
    await expect(jobCard).toBeVisible();
    await jobCard.click();

    await expect(page).toHaveURL(/\/careers\/.+/);
    await expect(page.getByRole('heading', { name: /about the role/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apply now/i })).toBeVisible();
  });

  test('sends an anonymous visitor to sign in before applying', async ({ page }) => {
    await page.goto('/careers');
    await page.locator('h3').first().click();
    await expect(page.getByRole('button', { name: /apply now/i })).toBeVisible();
    await page.getByRole('button', { name: /apply now/i }).click();

    // Must not open the application form without an account.
    await expect(page).toHaveURL(/\/login/);
  });

  test('the public API does not expose internal fields', async () => {
    // Addressed explicitly: a relative /api request would be answered by
    // Vite's SPA fallback with 200 and an HTML body.
    const api = await playwrightRequest.newContext({ baseURL: API_ORIGIN });
    const response = await api.get('/api/public/jobs');

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const raw = JSON.stringify(await response.json());

    for (const leak of [
      'internalNotes',
      'recruiterId',
      'hiringManagerId',
      'applicationCount',
      'passwordHash',
      'requestedById',
      'approvals',
    ]) {
      expect(raw, `public payload must not contain ${leak}`).not.toContain(leak);
    }

    await api.dispose();
  });

  test('the public API rejects anonymous access to protected routes', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API_ORIGIN });

    for (const path of ['/api/jobs', '/api/candidates', '/api/admin/users', '/api/dashboard/summary']) {
      const response = await api.get(path);
      expect(response.status(), `${path} must require authentication`).toBe(401);
    }

    await api.dispose();
  });

  test('returns a clear message for a job that does not exist', async ({ page }) => {
    await page.goto('/careers/this-slug-does-not-exist');
    await expect(page.getByText(/no longer available/i)).toBeVisible();
  });

  test('filters by keyword', async ({ page }) => {
    await page.goto('/careers');

    await page.getByPlaceholder(/job title or skill/i).fill('zzz-no-such-role');
    await page.getByRole('button', { name: /search jobs/i }).click();

    await expect(page.getByText(/no positions match/i)).toBeVisible();
  });

  test('has no horizontal overflow at the current viewport', async ({ page }) => {
    await page.goto('/careers');
    await expect(page.getByRole('heading', { name: /build your career/i })).toBeVisible();

    // A horizontal scrollbar is the classic responsive-layout bug, and
    // this spec also runs at phone width.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
