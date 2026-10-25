import { PrismaService } from '../prisma/prisma.service';

/**
 * Human-readable business identifiers (JR-2026-0001, CAND-2026-000123).
 *
 * These are display codes layered on top of the real UUID primary keys,
 * never used as foreign keys themselves. Generation runs inside the same
 * transaction as the insert, and the column's UNIQUE constraint is the
 * real guarantee -- if two requests race, one hits the constraint and
 * retries rather than silently duplicating.
 */

type PrismaLike = PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

async function nextSequence(
  tx: PrismaLike,
  model: 'jobRequirement' | 'candidateProfile' | 'jobApplication' | 'interview' | 'offer' | 'onboardingRecord',
  field: string,
  prefix: string,
  padding: number,
): Promise<string> {
  const year = new Date().getFullYear();
  const search = `${prefix}-${year}-`;

  // Highest existing code for this year. Lexical ordering is safe
  // because the numeric part is zero-padded to a fixed width.
  const latest = await (tx as any)[model].findFirst({
    where: { [field]: { startsWith: search } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });

  const lastNumber = latest
    ? Number.parseInt(String(latest[field]).slice(search.length), 10)
    : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;

  return `${search}${String(next).padStart(padding, '0')}`;
}

export const generateJobCode = (tx: PrismaLike) =>
  nextSequence(tx, 'jobRequirement', 'requirementCode', 'JR', 4);

export const generateCandidateCode = (tx: PrismaLike) =>
  nextSequence(tx, 'candidateProfile', 'candidateCode', 'CAND', 6);

export const generateApplicationCode = (tx: PrismaLike) =>
  nextSequence(tx, 'jobApplication', 'applicationCode', 'APP', 6);

export const generateInterviewCode = (tx: PrismaLike) =>
  nextSequence(tx, 'interview', 'interviewCode', 'INT', 6);

export const generateOfferCode = (tx: PrismaLike) =>
  nextSequence(tx, 'offer', 'offerCode', 'OFR', 6);

export const generateOnboardingCode = (tx: PrismaLike) =>
  nextSequence(tx, 'onboardingRecord', 'onboardingCode', 'ONB', 6);

/**
 * URL slug for the public careers portal.
 * A short random suffix keeps slugs unique without exposing row counts.
 */
export function slugify(title: string, suffix: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return `${base || 'job'}-${suffix.toLowerCase()}`;
}

/** Normalises an email for duplicate detection (not for login lookup). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits only, so +1 (555) 010-9999 and 15550109999 collide as expected. */
export function normalisePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits.slice(-15) : null;
}
