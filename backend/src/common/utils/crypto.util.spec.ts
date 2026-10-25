import {
  generateRecoveryCodes,
  generateToken,
  hashPassword,
  hashToken,
  safeCompare,
  sha256File,
  validatePasswordStrength,
  verifyPassword,
} from './crypto.util';

describe('Password hashing (Argon2id)', () => {
  // Argon2id is deliberately slow; these need more than the 5s default.
  jest.setTimeout(30_000);

  it('produces an argon2id hash', async () => {
    const hash = await hashPassword('CorrectHorseBattery1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('salts each hash, so the same password hashes differently', async () => {
    const first = await hashPassword('CorrectHorseBattery1');
    const second = await hashPassword('CorrectHorseBattery1');
    expect(first).not.toBe(second);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('CorrectHorseBattery1');
    await expect(verifyPassword(hash, 'CorrectHorseBattery1')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectHorseBattery1');
    await expect(verifyPassword(hash, 'WrongHorseBattery1')).resolves.toBe(false);
  });

  // A corrupt stored hash must never become an authentication bypass.
  it('returns false rather than throwing on a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
    await expect(verifyPassword('', 'anything')).resolves.toBe(false);
  });
});

describe('Password strength rules', () => {
  it('accepts a strong password', () => {
    expect(validatePasswordStrength('CorrectHorse9Battery')).toEqual([]);
  });

  it('requires at least 12 characters', () => {
    expect(validatePasswordStrength('Short1A')).toContain(
      'Password must be at least 12 characters',
    );
  });

  it('requires mixed case and a digit', () => {
    expect(validatePasswordStrength('alllowercase123')).toContain(
      'Password must contain an uppercase letter',
    );
    expect(validatePasswordStrength('ALLUPPERCASE123')).toContain(
      'Password must contain a lowercase letter',
    );
    expect(validatePasswordStrength('NoDigitsInHere')).toContain(
      'Password must contain a digit',
    );
  });

  it('rejects common phrases even when they satisfy the character rules', () => {
    expect(validatePasswordStrength('MyPassword123')).toContain(
      'Password contains a commonly used phrase',
    );
    expect(validatePasswordStrength('Qwerty123456A')).toContain(
      'Password contains a commonly used phrase',
    );
  });

  it('rejects an absurdly long password (hashing DoS guard)', () => {
    expect(validatePasswordStrength('A1'.repeat(200))).toContain(
      'Password must be at most 128 characters',
    );
  });
});

describe('Token generation and hashing', () => {
  it('generates URL-safe tokens', () => {
    const token = generateToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(30);
  });

  it('generates a different token every time', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken(16)));
    expect(tokens.size).toBe(200);
  });

  it('hashes tokens deterministically with SHA-256', () => {
    const token = 'a-known-token';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('safeCompare', () => {
  it('matches identical strings', () => {
    expect(safeCompare('secret-value', 'secret-value')).toBe(true);
  });

  it('rejects different strings', () => {
    expect(safeCompare('secret-value', 'secret-valuf')).toBe(false);
  });

  // timingSafeEqual throws on length mismatch; the wrapper must not.
  it('handles a length mismatch without throwing', () => {
    expect(safeCompare('short', 'much-longer-value')).toBe(false);
    expect(safeCompare('', 'x')).toBe(false);
  });
});

describe('File checksums', () => {
  it('hashes identical content identically', () => {
    const buffer = Buffer.from('resume contents');
    expect(sha256File(buffer)).toBe(sha256File(Buffer.from('resume contents')));
    expect(sha256File(buffer)).toHaveLength(64);
  });

  it('detects a single changed byte', () => {
    expect(sha256File(Buffer.from('resume contents'))).not.toBe(
      sha256File(Buffer.from('resume contentt')),
    );
  });
});

describe('MFA recovery codes', () => {
  it('generates ten unique codes by default', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('formats codes readably', () => {
    for (const code of generateRecoveryCodes(5)) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });
});
