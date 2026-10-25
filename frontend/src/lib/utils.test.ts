import { describe, expect, it } from 'vitest';
import {
  cn,
  formatBytes,
  formatCurrency,
  formatDate,
  formatDuration,
  formatExperience,
  formatSalaryRange,
  humanise,
  initials,
  isValidStageTransition,
  STAGE_LABELS,
  STAGE_ORDER,
} from './utils';
import type { ApplicationStage } from './types';

/**
 * The frontend mirrors the server's stage rules so an impossible drop
 * target can be disabled before the request is sent. The server
 * re-validates regardless — if these two ever disagree, the server
 * wins and the UI simply shows a stale affordance. These tests keep
 * them in step.
 */
describe('Stage transition rules (mirror of the server)', () => {
  it('exposes all 12 stages in order', () => {
    expect(STAGE_ORDER).toHaveLength(12);
    expect(STAGE_ORDER[0]).toBe('APPLIED');
    expect(STAGE_ORDER.at(-1)).toBe('HIRED');
  });

  it('labels every stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });

  it('allows forward movement and single-step rollback', () => {
    expect(isValidStageTransition('APPLIED', 'RESUME_SCREENING')).toBe(true);
    expect(isValidStageTransition('APPLIED', 'SHORTLISTED')).toBe(true);
    expect(isValidStageTransition('HR_SCREENING', 'RESUME_SCREENING')).toBe(true);
  });

  it('rejects rolling back more than one stage', () => {
    expect(isValidStageTransition('FINAL_INTERVIEW', 'APPLIED')).toBe(false);
  });

  it('only allows HIRED from OFFER_ACCEPTED', () => {
    expect(isValidStageTransition('OFFER_ACCEPTED', 'HIRED')).toBe(true);
    expect(isValidStageTransition('SELECTED', 'HIRED')).toBe(false);
    expect(isValidStageTransition('OFFER_RELEASED', 'HIRED')).toBe(false);
  });

  it('only allows OFFER_ACCEPTED from OFFER_RELEASED', () => {
    expect(isValidStageTransition('OFFER_RELEASED', 'OFFER_ACCEPTED')).toBe(true);
    expect(isValidStageTransition('SELECTED', 'OFFER_ACCEPTED')).toBe(false);
  });

  it('rejects a no-op transition', () => {
    for (const stage of STAGE_ORDER) {
      expect(isValidStageTransition(stage, stage)).toBe(false);
    }
  });

  it('rejects unknown stages', () => {
    expect(isValidStageTransition('NOPE' as ApplicationStage, 'APPLIED')).toBe(false);
  });
});

describe('humanise', () => {
  it('converts SCREAMING_SNAKE_CASE to Title Case', () => {
    expect(humanise('PENDING_APPROVAL')).toBe('Pending Approval');
    expect(humanise('FULL_TIME')).toBe('Full Time');
    expect(humanise('HIRED')).toBe('Hired');
  });

  it('renders an em dash for empty values', () => {
    expect(humanise(null)).toBe('—');
    expect(humanise(undefined)).toBe('—');
    expect(humanise('')).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('formats a numeric amount', () => {
    expect(formatCurrency(50000, 'USD')).toContain('50,000');
  });

  it('accepts the string Decimals that Prisma returns', () => {
    expect(formatCurrency('50000', 'USD')).toContain('50,000');
  });

  it('renders an em dash when there is no amount', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency('')).toBe('—');
  });

  // An unrecognised ISO code must not crash the page.
  it('falls back gracefully for an invalid currency code', () => {
    expect(formatCurrency(1000, 'NOTACODE')).toContain('1,000');
  });
});

describe('formatSalaryRange', () => {
  it('formats a full range', () => {
    const result = formatSalaryRange(40000, 60000, 'USD');
    expect(result).toContain('40,000');
    expect(result).toContain('60,000');
  });

  it('handles a one-sided range', () => {
    expect(formatSalaryRange(40000, null, 'USD')).toContain('40,000');
    expect(formatSalaryRange(null, 60000, 'USD')).toContain('60,000');
  });

  it('says "Not disclosed" when there is no range', () => {
    expect(formatSalaryRange(null, null)).toBe('Not disclosed');
  });
});

describe('formatExperience', () => {
  it('formats a range, a minimum and a maximum', () => {
    expect(formatExperience(3, 8)).toBe('3–8 yrs');
    expect(formatExperience(3, null)).toBe('3+ yrs');
    expect(formatExperience(null, 5)).toBe('Up to 5 yrs');
  });

  it('says "Any" when unspecified', () => {
    expect(formatExperience(null, null)).toBe('Any');
  });
});

describe('formatDuration', () => {
  it('formats days, hours and minutes', () => {
    expect(formatDuration(3 * 86400 + 4 * 3600)).toBe('3d 4h');
    expect(formatDuration(5 * 3600 + 30 * 60)).toBe('5h 30m');
    expect(formatDuration(45 * 60)).toBe('45m');
  });

  it('handles missing or negative values', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-10)).toBe('—');
  });
});

describe('formatBytes', () => {
  it('scales to the right unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-10-14T12:00:00.000Z')).toMatch(/\d{2} \w{3} 2026/);
  });

  it('renders a fallback for missing or invalid input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('initials', () => {
  it('takes the first letter of up to two names', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('Daniel')).toBe('D');
    expect(initials('Ana Maria Lopez')).toBe('AM');
  });

  it('handles empty input', () => {
    expect(initials(null)).toBe('?');
    expect(initials('')).toBe('?');
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('lets later Tailwind utilities win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
