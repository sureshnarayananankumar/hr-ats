/**
 * Typed application configuration.
 *
 * Every secret is read from the environment. Nothing sensitive is ever
 * hard-coded here, and `validateEnv` refuses to boot if a required
 * secret is missing or too weak.
 */

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  frontendUrl: string;

  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  };

  cookies: {
    /** Unset => host-only cookie, which is the stricter default. */
    domain?: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };

  security: {
    csrfSecret: string;
    sessionSecret: string;
    corsOrigins: string[];
    trustProxyHops: number;
    gatewaySharedSecret: string;
    /** Failed logins before the account is temporarily locked. */
    maxFailedLogins: number;
    lockoutMinutes: number;
    /** Roles that must complete MFA before receiving a session. */
    mfaRequiredRoles: string[];
  };

  storage: {
    root: string;
    maxUploadBytes: number;
    allowedMimeTypes: string[];
  };

  redis: {
    host: string;
    port: number;
    password?: string;
  };

  mail: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
}

const parseList = (value: string | undefined, fallback: string[] = []): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
};

export default (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: parseInteger(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      accessTtlSeconds: parseInteger(process.env.JWT_ACCESS_TTL, 900),
      refreshTtlSeconds: parseInteger(process.env.JWT_REFRESH_TTL, 604800),
    },

    cookies: {
      domain: process.env.COOKIE_DOMAIN || undefined,
      secure: parseBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production'),
      sameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as AppConfig['cookies']['sameSite'],
    },

    security: {
      csrfSecret: process.env.CSRF_SECRET ?? '',
      sessionSecret: process.env.SESSION_SECRET ?? '',
      corsOrigins: parseList(process.env.CORS_ORIGINS, ['http://localhost:5173']),
      trustProxyHops: parseInteger(process.env.TRUST_PROXY_HOPS, 1),
      gatewaySharedSecret: process.env.GATEWAY_SHARED_SECRET ?? '',
      maxFailedLogins: parseInteger(process.env.MAX_FAILED_LOGINS, 5),
      lockoutMinutes: parseInteger(process.env.LOCKOUT_MINUTES, 15),
      mfaRequiredRoles: parseList(process.env.MFA_REQUIRED_ROLES, [
        'SUPER_ADMIN',
        'HR_ADMIN',
      ]),
    },

    storage: {
      root: process.env.STORAGE_ROOT ?? '/app/storage',
      maxUploadBytes: parseInteger(process.env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
      allowedMimeTypes: parseList(process.env.ALLOWED_UPLOAD_MIME, [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]),
    },

    redis: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: parseInteger(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    mail: {
      host: process.env.SMTP_HOST ?? 'mailhog',
      port: parseInteger(process.env.SMTP_PORT, 1025),
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      from: process.env.MAIL_FROM ?? 'HR ATS <no-reply@hr-ats.local>',
    },
  };
};

/**
 * Fail fast at boot rather than leaking a misconfigured deployment.
 * Weak or missing secrets are a deployment bug, not a runtime warning.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProd = env.NODE_ENV === 'production';

  const requireSecret = (key: string, minLength: number) => {
    const value = env[key];
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${key} is required`);
      return;
    }
    if (value.length < minLength) {
      errors.push(`${key} must be at least ${minLength} characters (got ${value.length})`);
    }
    if (/CHANGE_ME/i.test(value)) {
      errors.push(`${key} still contains a CHANGE_ME placeholder`);
    }
  };

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');

  requireSecret('JWT_ACCESS_SECRET', 32);
  requireSecret('JWT_REFRESH_SECRET', 32);
  requireSecret('SESSION_SECRET', 32);
  requireSecret('CSRF_SECRET', 16);
  requireSecret('GATEWAY_SHARED_SECRET', 16);

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (isProd) {
    if (String(env.COOKIE_SECURE).toLowerCase() !== 'true') {
      errors.push('COOKIE_SECURE must be true in production (HTTPS only)');
    }
    const origins = String(env.CORS_ORIGINS ?? '');
    if (origins.includes('*')) {
      errors.push('CORS_ORIGINS must not contain a wildcard when credentials are used');
    }
    if (!origins) {
      errors.push('CORS_ORIGINS is required in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
        `See .env.example for the full list of required values.`,
    );
  }

  return env;
}
