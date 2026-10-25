import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the API base-URL resolution.
 *
 * The bug: session cookies are SameSite=Lax, which the browser does NOT
 * send on cross-site fetches. `localhost` and `127.0.0.1` are different
 * hosts, so a page served from one calling an API on the other logged in
 * successfully (200, cookie set) and was then anonymous on every
 * subsequent request (401, cookie never sent).
 *
 * The fix pins the API hostname to whatever hostname the page was loaded
 * from, but only between loopback aliases — a real deployment host must
 * never be rewritten.
 */

const ORIGINAL_ENV = { ...import.meta.env };

function setPageHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname },
  });
}

async function loadBaseUrl(configured: string, pageHostname: string): Promise<string> {
  vi.stubEnv('VITE_API_BASE_URL', configured);
  setPageHostname(pageHostname);

  // The base URL is computed once at module load, so the module cache
  // has to be cleared between cases.
  vi.resetModules();
  const module = await import('./api');

  // Exercised through a real call so we observe the URL actually used.
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  );

  await module.api.get('/health');
  const calledWith = String(fetchSpy.mock.calls[0]?.[0] ?? '');
  fetchSpy.mockRestore();

  return calledWith;
}

describe('API base URL resolution', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.assign(import.meta.env, ORIGINAL_ENV);
  });

  it('rewrites localhost to 127.0.0.1 when the page is on 127.0.0.1', async () => {
    const url = await loadBaseUrl('http://localhost:8000/api', '127.0.0.1');
    expect(url).toContain('http://127.0.0.1:8000/api');
    expect(url).not.toContain('localhost');
  });

  it('rewrites 127.0.0.1 to localhost when the page is on localhost', async () => {
    const url = await loadBaseUrl('http://127.0.0.1:8000/api', 'localhost');
    expect(url).toContain('http://localhost:8000/api');
    expect(url).not.toContain('127.0.0.1');
  });

  it('leaves the host alone when it already matches the page', async () => {
    const url = await loadBaseUrl('http://localhost:8000/api', 'localhost');
    expect(url).toContain('http://localhost:8000/api');
  });

  it('preserves the port and path, rewriting only the hostname', async () => {
    const url = await loadBaseUrl('http://localhost:9999/custom/api', '127.0.0.1');
    expect(url).toContain('http://127.0.0.1:9999/custom/api');
  });

  // The important negative case: a deployed API host must never be
  // swapped for whatever hostname the page happens to be served from.
  it('never rewrites a non-loopback host', async () => {
    const url = await loadBaseUrl('https://api.example.com/api', '127.0.0.1');
    expect(url).toContain('https://api.example.com/api');
    expect(url).not.toContain('127.0.0.1');
  });

  it('never rewrites when the page itself is on a real host', async () => {
    const url = await loadBaseUrl('http://localhost:8000/api', 'app.example.com');
    expect(url).toContain('http://localhost:8000/api');
  });

  it('leaves a relative base URL untouched', async () => {
    const url = await loadBaseUrl('/api', '127.0.0.1');
    expect(url).toContain('/api/health');
    expect(url).not.toContain('http://');
  });
});
