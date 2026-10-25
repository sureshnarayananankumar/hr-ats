import { expect, test, request as playwrightRequest } from '@playwright/test';
import { API_ORIGIN, statePath } from './roles';

/**
 * Role-based access, exercised with real sessions saved by auth.setup.
 *
 * The decisive tests here bypass the interface entirely and call the API
 * with a candidate's genuine cookies — proving authorization is enforced
 * by the server, not by hiding menu items.
 */
// ---------------------------------------------------------------------
//  Navigation visibility
// ---------------------------------------------------------------------
test.describe('Navigation reflects permissions', () => {
  test.use({ storageState: statePath('hrAdmin') });

  test('HR admin sees recruitment navigation but not audit logs', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('link', { name: 'Job Requirements' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Candidates' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Offers' })).toBeVisible();

    // Audit logs and settings belong to Super Admin only.
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  });

  test('dashboard shows live counts from the database', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/total job requirements/i)).toBeVisible();
    await expect(page.getByText(/open positions/i)).toBeVisible();
    await expect(page.getByText(/applications by month/i)).toBeVisible();
  });
});

test.describe('Super admin navigation', () => {
  test.use({ storageState: statePath('superAdmin') });

  test('additionally sees audit logs and settings', async ({ page }) => {
    await page.goto('/dashboard');

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'User Management' })).toBeVisible();
  });

  test('can open the audit trail', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: /audit logs/i })).toBeVisible();
    await expect(page.getByText(/failed logins/i)).toBeVisible();
  });
});

test.describe('Interviewer navigation', () => {
  test.use({ storageState: statePath('interviewer') });

  test('sees a deliberately narrow menu', async ({ page }) => {
    await page.goto('/interviews');

    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('link', { name: 'Interviews' })).toBeVisible();

    await expect(nav.getByRole('link', { name: 'User Management' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Offers' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Job Approvals' })).toHaveCount(0);
  });

  test('is shown a clear message on a forbidden route, not a crash', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByText(/do not have access/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------
//  Candidate portal
// ---------------------------------------------------------------------
test.describe('Candidate portal', () => {
  test.use({ storageState: statePath('candidate') });

  test('lands in the portal, not the staff dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.getByRole('heading', { name: /my applications/i })).toBeVisible();
  });

  test('can open its own profile', async ({ page }) => {
    await page.goto('/portal/profile');
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
  });

  test('is redirected away from the staff dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // The route renders the permission message rather than HR data.
    await expect(page.getByText(/do not have access/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------
//  API-level authorization — the tests that actually matter
// ---------------------------------------------------------------------
test.describe('Authorization is enforced by the API', () => {
  test('candidate session is refused on every staff endpoint', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      storageState: statePath('candidate'),
    });

    for (const path of [
      '/api/admin/users',
      '/api/admin/audit-logs',
      '/api/admin/settings',
      '/api/candidates',
      '/api/dashboard/summary',
      '/api/reports/open-vacancies',
    ]) {
      const response = await api.get(path);
      expect(response.status(), `${path} must be forbidden for a candidate`).toBe(403);
    }

    await api.dispose();
  });

  test('spoofed identity headers grant nothing', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      storageState: statePath('candidate'),
    });

    const response = await api.get('/api/admin/users', {
      headers: {
        'X-User-Id': '00000000-0000-0000-0000-000000000000',
        'X-Role': 'SUPER_ADMIN',
        'X-Roles': 'SUPER_ADMIN,HR_ADMIN',
        'X-Permissions': 'user.read,audit.read',
        'X-Gateway-Secret': 'forged',
      },
    });

    expect(response.status()).toBe(403);
    await api.dispose();
  });

  test('HR admin is refused the audit trail (Super Admin only)', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      storageState: statePath('hrAdmin'),
    });

    expect((await api.get('/api/admin/audit-logs')).status()).toBe(403);

    // ...but can read what their role does cover.
    expect((await api.get('/api/dashboard/summary')).status()).toBe(200);
    expect((await api.get('/api/jobs')).status()).toBe(200);

    await api.dispose();
  });

  test('interviewer cannot reach offers or administration', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      storageState: statePath('interviewer'),
    });

    expect((await api.get('/api/offers')).status()).toBe(403);
    expect((await api.get('/api/admin/users')).status()).toBe(403);
    expect((await api.get('/api/reports/open-vacancies')).status()).toBe(403);

    await api.dispose();
  });

  test('a candidate never receives another candidate in a response', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: API_ORIGIN,
      storageState: statePath('candidate'),
    });

    const response = await api.get('/api/applications');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const own = await (await api.get('/api/candidates/me')).json();

    // Every returned application must belong to this candidate.
    for (const application of body.data ?? []) {
      expect(application.candidateId).toBe(own.id);
    }

    await api.dispose();
  });
});
