import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isValid, parseISO } from 'date-fns';
import type { ApplicationStage, JobStatus, OfferStatus } from './types';

/** Merges class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------
//  Dates
// ---------------------------------------------------------------------

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy') : fallback;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy, HH:mm') : fallback;
}

export function formatRelative(value: string | Date | null | undefined, fallback = '—'): string {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : fallback;
}

/** "3d 4h" style duration, used for stage-age indicators. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function daysSince(value: string | Date | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------
//  Display formatting
// ---------------------------------------------------------------------

/** SCREAMING_SNAKE_CASE -> "Title Case" */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatCurrency(
  amount: string | number | null | undefined,
  currency = 'USD',
): string {
  if (amount == null || amount === '') return '—';
  const numeric = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(numeric)) return '—';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    // An unrecognised ISO code must not crash the page.
    return `${currency} ${numeric.toLocaleString()}`;
  }
}

export function formatSalaryRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  currency = 'USD',
): string {
  if (!min && !max) return 'Not disclosed';
  if (min && max) return `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`;
  return formatCurrency(min ?? max, currency);
}

export function formatExperience(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null && max == null) return 'Any';
  if (min != null && max != null) return `${min}–${max} yrs`;
  if (min != null) return `${min}+ yrs`;
  return `Up to ${max} yrs`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

// ---------------------------------------------------------------------
//  Status presentation
//
//  One mapping drives every badge in the app, so a status reads the
//  same way on the dashboard, a table and a pipeline card.
// ---------------------------------------------------------------------

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const JOB_STATUS_TONE: Record<JobStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
};

export const APPLICATION_STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: 'info',
  ON_HOLD: 'warning',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
  OFFER_DECLINED: 'danger',
  HIRED: 'success',
};

export const OFFER_STATUS_TONE: Record<OfferStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  SENT: 'info',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};

/** The 12 default stages, in order, with display labels. */
export const STAGE_ORDER: ApplicationStage[] = [
  'APPLIED',
  'RESUME_SCREENING',
  'HR_SCREENING',
  'SHORTLISTED',
  'ASSESSMENT',
  'TECHNICAL_INTERVIEW',
  'HR_INTERVIEW',
  'FINAL_INTERVIEW',
  'SELECTED',
  'OFFER_RELEASED',
  'OFFER_ACCEPTED',
  'HIRED',
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  RESUME_SCREENING: 'Resume Screening',
  HR_SCREENING: 'HR Screening',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment / Test',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  HR_INTERVIEW: 'HR Interview',
  FINAL_INTERVIEW: 'Final Interview',
  SELECTED: 'Selected',
  OFFER_RELEASED: 'Offer Released',
  OFFER_ACCEPTED: 'Offer Accepted',
  HIRED: 'Hired',
};

/**
 * Mirrors the server's transition rules so the UI can disable an
 * impossible drop target. The server re-checks this regardless -- this
 * copy is for feedback, not enforcement.
 */
export function isValidStageTransition(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  if (to === 'HIRED') return from === 'OFFER_ACCEPTED';
  if (to === 'OFFER_ACCEPTED') return from === 'OFFER_RELEASED';
  if (toIndex > fromIndex) return true;
  return fromIndex - toIndex === 1;
}

/** Chart palette, kept colour-blind-safe and consistent across views. */
export const CHART_COLOURS = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#4f46e5',
  '#059669',
  '#db2777',
];

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
