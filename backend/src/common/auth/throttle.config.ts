/**
 * Per-route rate limits for the sensitive auth endpoints.
 *
 * These are read from the process environment at class-definition time,
 * because @Throttle is a decorator and is evaluated before Nest's
 * ConfigService exists. That means they must come from the real
 * environment (docker-compose `environment:` or an exported shell
 * variable), not from a .env file parsed at runtime.
 *
 * The defaults are the secure production values. Raising them is only
 * appropriate for local test runs -- scripts/smoke-test.sh exports
 * AUTH_THROTTLE_LIMIT so a full pass is not throttled by its own logins.
 * Kong enforces the same limits at the edge, so a raised value here does
 * not disable protection for traffic arriving through the gateway.
 */
const readLimit = (name: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const WINDOW_MS = 60_000;

/** Login: deliberately tight -- this is the brute-force surface. */
export const LOGIN_THROTTLE = {
  default: { limit: readLimit('AUTH_THROTTLE_LIMIT', 5), ttl: WINDOW_MS },
};

/** Registration: limits automated account creation. */
export const REGISTER_THROTTLE = {
  default: { limit: readLimit('REGISTER_THROTTLE_LIMIT', 5), ttl: WINDOW_MS },
};

/** Password reset: the lowest limit, as it sends email to a third party. */
export const RESET_THROTTLE = {
  default: { limit: readLimit('RESET_THROTTLE_LIMIT', 3), ttl: WINDOW_MS },
};

/** MFA verification: allows for typos without permitting code guessing. */
export const MFA_THROTTLE = {
  default: { limit: readLimit('MFA_THROTTLE_LIMIT', 10), ttl: WINDOW_MS },
};

/** Public careers portal browsing. */
export const PUBLIC_THROTTLE = {
  default: { limit: readLimit('PUBLIC_THROTTLE_LIMIT', 60), ttl: WINDOW_MS },
};
