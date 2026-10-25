import * as argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Argon2id parameters.
 *
 * Chosen to land around ~100ms per hash on typical server hardware,
 * following OWASP's password-storage guidance (19 MiB memory, t=2, p=1).
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/**
 * Verifies a password. Returns false rather than throwing on a malformed
 * stored hash, so a corrupt row can never become an auth bypass.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Cryptographically random, URL-safe token for emails and sessions. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored only as SHA-256 digests. A database leak therefore
 * yields nothing usable. SHA-256 (not Argon2) is correct here because
 * the input already has full entropy and lookups must stay fast.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sha256File(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Constant-time string comparison, for secrets and CSRF tokens. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Recovery codes shown once at MFA setup, then stored hashed. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
  );
}

/**
 * Rejects passwords that are too short or obviously weak.
 * Deliberately permissive about composition -- length and a blocklist
 * beat arbitrary character-class rules (NIST SP 800-63B).
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (password.length > 128) errors.push('Password must be at most 128 characters');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a digit');

  const common = [
    'password', 'qwerty', '123456', 'letmein', 'welcome',
    'admin', 'changeme', 'passw0rd', 'iloveyou',
  ];
  const lower = password.toLowerCase();
  if (common.some((entry) => lower.includes(entry))) {
    errors.push('Password contains a commonly used phrase');
  }

  return errors;
}
