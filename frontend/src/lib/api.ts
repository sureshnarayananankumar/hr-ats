/**
 * API client.
 *
 * Design notes:
 *  - Credentials are HTTP-only cookies set by the server. No token is
 *    ever stored in localStorage, so XSS cannot read a session.
 *  - Every state-changing request carries the CSRF token from the
 *    readable double-submit cookie.
 *  - A single 401 triggers one refresh attempt; concurrent 401s share
 *    that attempt rather than each firing their own refresh.
 */

/**
 * Resolves the API base URL, pinning it to the hostname the page was
 * actually loaded from.
 *
 * Why this matters: session cookies are `SameSite=Lax`, which the
 * browser does NOT send on cross-site fetches. `localhost` and
 * `127.0.0.1` are different hosts, so a page served from one calling an
 * API on the other logs in successfully (the cookie is set) and is then
 * anonymous on every subsequent request (the cookie is never sent) —
 * a confusing 200-then-401 sequence.
 *
 * Rewriting only the hostname, and only between loopback aliases, keeps
 * the page and the API same-site whichever address is used. A
 * configured non-loopback host (a real deployment) is left untouched.
 */
function resolveBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string) ?? '/api';

  // A relative base is already same-origin; nothing to do.
  if (!/^https?:\/\//i.test(configured)) return configured;
  if (typeof window === 'undefined') return configured;

  try {
    const url = new URL(configured);
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'];
    const pageHost = window.location.hostname;

    if (loopback.includes(url.hostname) && loopback.includes(pageHost) && url.hostname !== pageHost) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }

    return configured;
  } catch {
    return configured;
  }
}

const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the user is signed in but lacks the required permission. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

/** Fetches a CSRF token if we do not already hold one. */
async function ensureCsrfToken(): Promise<string | undefined> {
  const existing = readCookie('hr_ats_csrf');
  if (existing) return existing;

  try {
    await fetch(`${BASE_URL}/auth/csrf`, { credentials: 'include' });
    return readCookie('hr_ats_csrf');
  } catch {
    return undefined;
  }
}

// Shared across concurrent 401s so only one refresh is in flight.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        // Cleared on the next tick so callers awaiting this promise all
        // observe the same result before a new attempt can start.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      });
  }
  return refreshPromise;
}

/** Called when a session cannot be recovered. Set by the auth provider. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skips the automatic refresh-and-retry (used by auth calls). */
  skipRetry?: boolean;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    // Arrays are sent comma-separated; the DTOs split them server-side.
    params.append(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRetry, query, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (isMutation) {
    const csrf = await ensureCsrfToken();
    if (csrf) requestHeaders['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    method,
    headers: requestHeaders,
    // Sends the HTTP-only session cookie.
    credentials: 'include',
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  // Expired access token -> refresh once, then replay the request.
  if (response.status === 401 && !skipRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipRetry: true });
    }
    onSessionExpired?.();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    let requestId: string | undefined;

    if (contentType.includes('application/json')) {
      try {
        const payload = await response.json();
        // The API returns `message` as a string or an array of
        // validation errors; present both as readable text.
        message = Array.isArray(payload.message)
          ? payload.message.join('\n')
          : (payload.message ?? message);
        details = payload.details;
        requestId = payload.requestId;
      } catch {
        /* fall through to the generic message */
      }
    }

    throw new ApiError(response.status, message, details, requestId);
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    apiFetch<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Triggers a file download through an authenticated request.
 *
 * A plain <a href> cannot be used: these endpoints require the session
 * cookie plus permission checks, and the response is a stream rather
 * than a public URL.
 */
export async function downloadFile(
  path: string,
  filename: string,
  query?: RequestOptions['query'],
): Promise<void> {
  const response = await fetch(buildUrl(path, query), { credentials: 'include' });

  if (!response.ok) {
    throw new ApiError(response.status, `Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Releasing the object URL avoids leaking the blob for the page's life.
  URL.revokeObjectURL(url);
}

export async function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);

  const csrf = await ensureCsrfToken();
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    // Content-Type is deliberately omitted: the browser must set the
    // multipart boundary itself.
    headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const payload = await response.json();
      message = Array.isArray(payload.message)
        ? payload.message.join('\n')
        : (payload.message ?? message);
    } catch {
      /* use the generic message */
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}
